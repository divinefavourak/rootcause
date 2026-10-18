"""Optional Claude calls. Every function returns None on any problem, and callers fall back to templates."""
import json
import logging
import os

log = logging.getLogger("rootcause.llm")

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5")

_client = None


def _get_client():
    global _client
    if _client is None:
        if not os.getenv("ANTHROPIC_API_KEY"):
            return None
        import anthropic
        _client = anthropic.Anthropic(timeout=12.0, max_retries=1)
    return _client


def _ask(system: str, prompt: str, schema: dict | None = None, max_tokens: int = 2000) -> str | None:
    client = _get_client()
    if client is None:
        return None
    kwargs = dict(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        output_config={"effort": "low"},
        betas=["server-side-fallback-2026-07-01"],
        extra_body={"fallbacks": "default"},
    )
    if schema:
        kwargs["output_config"]["format"] = {"type": "json_schema", "schema": schema}
    try:
        response = client.beta.messages.create(**kwargs)
    except Exception as exc:  # network, auth, rate limit: the app must keep working
        log.warning("Claude call failed: %s", exc)
        return None
    if response.stop_reason == "refusal":
        return None
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    return text or None


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
    return _ask(VOICE, prompt, max_tokens=1500)


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
    text = _ask(VOICE, prompt, schema=NOTES_SCHEMA, max_tokens=4000)
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
    text = _ask(VOICE, prompt, schema=QUIZ_SCHEMA, max_tokens=3000)
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
