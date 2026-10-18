"""Optional AI calls through OpenRouter. Every function returns None on any problem, and callers fall back to templates."""
import json
import logging
import os
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

log = logging.getLogger("rootcause.llm")

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
TIMEOUT = 15
# Hard wall-clock limits, so a slow model can never hold up a student.
DEADLINE = {"explain": 20, "quiz": 10, "notes": 60}
_pool = ThreadPoolExecutor(max_workers=4)


def enabled() -> bool:
    return bool(os.getenv("OPENROUTER_API_KEY"))


def _within(seconds: float, fn, *args):
    future = _pool.submit(fn, *args)
    try:
        return future.result(timeout=seconds)
    except FuturesTimeout:
        log.warning("AI call took longer than %ss, using the fallback", seconds)
        return None


def _json_text(text: str) -> str | None:
    """Pull the JSON object out of a reply, tolerating code fences or a stray sentence around it."""
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    return text[start:end + 1] if start != -1 and end > start else None


def _ask(system: str, prompt: str, schema: dict | None = None, max_tokens: int = 2000) -> str | None:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        return None
    body = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "temperature": 0.4,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
    }
    if schema:
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "result", "strict": True, "schema": schema}}
        body["messages"][1]["content"] += "\n\nReply with JSON only, matching the requested shape."
    req = urllib.request.Request(
        API_URL, data=json.dumps(body).encode("utf-8"), method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("PUBLIC_URL", "https://rootcause-production-b767.up.railway.app"),
            "X-Title": "RootCause",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            data = json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:  # network, auth, rate limit: the app must keep working
        log.warning("OpenRouter call failed: %s", exc)
        return None
    try:
        choice = data["choices"][0]
        text = (choice["message"].get("content") or "").strip()
    except (KeyError, IndexError, TypeError):
        log.warning("OpenRouter returned no choices: %s", str(data)[:200])
        return None
    if not text or choice.get("finish_reason") == "content_filter":
        return None
    return _json_text(text) if schema else text


VOICE = (
    "You are RootCause, a warm, calm older student helping a Nigerian university student with "
    "IFT 211 Digital Logic. Short sentences. No jargon without explaining it. Light, friendly tone "
    "(a touch of Nigerian warmth like 'no wahala' is fine, never overdone). No markdown."
)


def explain_root_cause(stuck: str, root: str, score: int | None, chain: list[str]) -> str | None:
    score_text = f"{score}%" if score is not None else "not tried yet"
    prompt = (
        f"The student is stuck on '{stuck}'. Walking back the prerequisite graph, the weakest link is "
        f"'{root}' (their score: {score_text}). Path: {' -> '.join(chain)}.\n"
        "In at most 2 sentences (under 45 words), explain why weakness in the root concept makes the "
        "stuck topic feel hard, and encourage them to start there."
    )
    return _within(DEADLINE["explain"], _ask, VOICE, prompt, None, 400)


NOTES_SCHEMA = {
    "type": "object",
    "properties": {
        "notes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "points": {"type": "array", "items": {"type": "string"}},
                    "example": {"type": "string"},
                    "trap": {"type": "string"},
                },
                "required": ["id", "points", "example", "trap"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["notes"],
    "additionalProperties": False,
}


def study_notes(concepts: list[dict]) -> list[dict] | None:
    """One call for every concept in a plan that has no notes yet."""
    listing = "\n".join(f"- id={c['id']}: {c['name']} ({c['summary']})" for c in concepts)
    prompt = (
        "Write short revision notes for each IFT 211 Digital Logic topic below. For each: exactly 3 key "
        "points (each under 110 characters), one worked example (under 120 characters), and one common "
        "mistake students make (under 110 characters). Plain text, no markdown. Use the given ids.\n" + listing
    )
    text = _within(DEADLINE["notes"], _ask, VOICE, prompt, NOTES_SCHEMA, 3000)
    if not text:
        return None
    try:
        rows = json.loads(text)["notes"]
        return [{"id": str(r["id"]), "points": [str(p) for p in r["points"]][:3],
                 "example": str(r["example"]), "trap": str(r["trap"])} for r in rows if r.get("points")]
    except (ValueError, KeyError, TypeError):
        return None


QUIZ_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "answer": {"type": "integer"},
                    "why": {"type": "string"},
                },
                "required": ["prompt", "options", "answer", "why"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["questions"],
    "additionalProperties": False,
}


def quiz_questions(concept: str, summary: str) -> list[dict] | None:
    prompt = (
        f"Write exactly 3 multiple-choice questions testing '{concept}' ({summary}) at first-year "
        "university level. Each has exactly 4 short options (under 60 characters), one correct, "
        "'answer' is the 0-based index of the correct option (vary its position), and 'why' is one "
        "short sentence explaining the answer. Questions under 120 characters."
    )
    text = _within(DEADLINE["quiz"], _ask, VOICE, prompt, QUIZ_SCHEMA, 1500)
    if not text:
        return None
    try:
        questions = json.loads(text)["questions"]
        clean = []
        for q in questions[:3]:
            opts = [str(o) for o in q["options"]][:4]
            ans = int(q["answer"])
            if len(opts) == 4 and 0 <= ans < 4:
                clean.append({"prompt": str(q["prompt"]), "options": opts, "answer": ans, "why": str(q["why"])})
        return clean if len(clean) == 3 else None
    except (ValueError, KeyError, TypeError):
        return None
