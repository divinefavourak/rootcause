"""Business logic. Every fact comes from a Cypher query in queries.py; this file only shapes results."""
import random
import re
import uuid
from datetime import datetime, timedelta, timezone

from app import db, llm, queries as Q
from app.quiz_bank import BANK
from app.seed_data import COURSE

LAGOS = timezone(timedelta(hours=1))

FILLER = set("""
i im i'm dont don't do get understand understanding understood the a an about with struggling struggle
help me on stuck confused by what is are how does really at all topic still cant can't can of in to my
please explain learn learning know bit lost hard part this that it so just bad am we you for why when be
doing idea grasp clue need want teach some any whole those these something stuff thing things
""".split())


def status_of(score):
    # Mirrors the CASE in queries.STUDENT_OVERVIEW, for before/after comparisons.
    if score is None:
        return "Not tried"
    if score < 50:
        return "Weak"
    if score < 70:
        return "Okay"
    return "Strong"


def today() -> str:
    return datetime.now(LAGOS).date().isoformat()


class NotFound(Exception):
    pass


# ---------------------------------------------------------------- lookups

def list_students():
    return db.ro(Q.LIST_STUDENTS)


def list_concepts():
    return db.ro(Q.LIST_CONCEPTS, {"course": COURSE["code"]})


def get_concept(concept_id: str) -> dict:
    rows = db.ro(Q.GET_CONCEPT, {"concept_id": concept_id})
    if not rows:
        raise NotFound(f"Unknown concept: {concept_id}")
    return rows[0]


def _check_student(student_id: str) -> dict:
    for s in list_students():
        if s["id"] == student_id:
            return s
    raise NotFound(f"Unknown student: {student_id}")


# ---------------------------------------------------------------- resolve_concept

def _search_terms(text: str) -> tuple[str, str]:
    words = re.findall(r"[a-z0-9]+", text.lower().replace("'", "").replace("’", ""))
    words = [w for w in words if w not in FILLER]
    parts = []
    for w in words:
        parts.append(w)
        if len(w) >= 3:
            parts.append(f"{w}*")
        if len(w) >= 4:
            parts.append(f"%{w}%")
    return "|".join(parts), " ".join(words)


def resolve_concept(text: str) -> dict:
    search, plain = _search_terms(text or "")
    matches = []
    if search:
        try:
            matches = db.ro(Q.RESOLVE_CONCEPT, {"search": search, "plain": plain})
        except Exception:
            matches = []  # odd input the search syntax rejects: treat as no match
    for m in matches:
        m["confidence"] = round(float(m["confidence"]), 2)
        m.pop("raw", None)
    best = matches[0] if matches else None
    return {
        "query": text,
        "matches": matches,
        "best": best,
        "confident": bool(best and best["confidence"] >= 0.7),
    }


# ---------------------------------------------------------------- root_cause + fix_plan

def _task_for(step: dict, stuck_id: str) -> tuple[str, int]:
    if step["id"] == stuck_id:
        return f"Come back to {step['name']}. Try 5 questions now that the base is firmer.", 30
    if step["status"] == "Weak":
        return f"Re-learn it from scratch: {step['summary']} Then do 5 practice questions.", 40
    return f"Quick refresh: {step['summary']} Then 3 practice questions.", 25


def study_notes(ids: list[str]) -> dict:
    """Notes per concept: stored in the graph, else written once by Claude and saved, else built from the graph."""
    rows = db.ro(Q.CONCEPT_NOTES, {"ids": ids})
    missing = [r for r in rows if not r["points"]]
    if missing:
        written = llm.study_notes(missing)
        if written:
            known = {r["id"] for r in missing}
            written = [w for w in written if w["id"] in known]
            db.run(Q.SAVE_NOTES, {"rows": written})
            rows = db.ro(Q.CONCEPT_NOTES, {"ids": ids})
    notes = {}
    for r in rows:
        links = []
        if r["builds_on"]:
            links.append("Builds on " + ", ".join(sorted(r["builds_on"])) + ".")
        if r["leads_to"]:
            links.append("You need it for " + ", ".join(sorted(r["leads_to"])) + ".")
        if r["points"]:
            notes[r["id"]] = {"points": r["points"], "example": r["example"], "trap": r["trap"], "links": links}
        else:
            notes[r["id"]] = {"points": [r["summary"]] + links, "example": None, "trap": None, "links": []}
    return notes


def fix_plan(student_id: str, concept_id: str) -> list[dict]:
    rows = db.ro(Q.FIX_PLAN, {"student_id": student_id, "concept_id": concept_id})
    notes = study_notes(list(dict.fromkeys(r["id"] for r in rows)))
    days = {1: [], 2: [], 3: []}
    for row in rows:
        task, minutes = _task_for(row, concept_id)
        days[row["day"]].append({
            "id": row["id"], "name": row["name"], "score": row["score"],
            "status": row["status"], "task": task, "minutes": minutes, "notes": notes.get(row["id"]),
        })
    stuck_name = rows[-1]["name"] if rows else concept_id
    # Fewer than 3 steps: fill empty days with review so the plan always spans 3 days.
    for d in (1, 2, 3):
        if not days[d]:
            days[d].append({
                "id": concept_id, "name": stuck_name, "score": None, "status": "Review",
                "task": f"Mixed practice: 10 past-question style problems on {stuck_name}.", "minutes": 30,
            })
    return [{"day": d, "items": days[d], "minutes": sum(i["minutes"] for i in days[d])} for d in (1, 2, 3)]


_explain_cache: dict = {}


def _explanation(stuck: dict, root: dict, chain_names: list[str]) -> tuple[str, str]:
    if root["id"] == stuck["id"]:
        template = (f"Good news: your foundations for {stuck['name']} look solid. "
                    f"The topic itself is the part to work on, so let's practise it directly.")
    else:
        score = f"{root['score']}%" if root["score"] is not None else "not tried yet"
        template = (f"{stuck['name']} is built on {root['name']}, and your score there is {score}. "
                    f"Fix that first and everything above it gets easier.")
    key = (stuck["id"], root["id"], root["score"])
    if key not in _explain_cache:
        _explain_cache[key] = llm.explain_root_cause(stuck["name"], root["name"], root["score"], chain_names)
    text = _explain_cache[key]
    return (text, "ai") if text else (template, "template")


def _graph_view(concept_id, overview_rows):
    by_id = {r["id"]: r for r in overview_rows}
    nodes = db.ro(Q.ROOT_SYSTEM_NODES, {"concept_id": concept_id})
    edges = db.ro(Q.ROOT_SYSTEM_EDGES, {"concept_id": concept_id})
    return {
        "nodes": [{
            "id": n["id"], "name": n["name"], "summary": n["summary"], "hops": n["hops"],
            "unlocks": n["unlocks"], "status": by_id.get(n["id"], {}).get("status", "Not tried"),
            "score": by_id.get(n["id"], {}).get("score"),
        } for n in nodes],
        "edges": edges,
    }


def diagnose(student_id: str, concept_id: str, explain: bool = True) -> dict:
    student = _check_student(student_id)
    stuck = get_concept(concept_id)
    params = {"student_id": student_id, "concept_id": concept_id}

    root = db.ro(Q.ROOT_CAUSE, params)[0]
    chain_rows = db.ro(Q.ROOT_CHAIN, {**params, "root_id": root["id"]})
    # Display order: stuck topic on top, root cause at the bottom.
    chain = [{
        "id": r["id"], "name": r["name"], "score": r["score"], "status": r["status"],
        "is_root": r["id"] == root["id"], "is_stuck": r["id"] == concept_id,
    } for r in reversed(chain_rows)]

    result = {
        "student": {"id": student["id"], "name": student["name"]},
        "stuck": {"id": stuck["id"], "name": stuck["name"]},
        "root": {
            "id": root["id"], "name": root["name"], "summary": root["summary"],
            "score": root["score"], "status": status_of(root["score"]), "hops": root["hops"],
            "is_self": root["id"] == concept_id,
        },
        "chain": chain,
        "plan": fix_plan(student_id, concept_id),
    }
    if explain:
        text, source = _explanation(stuck, root, [r["name"] for r in chain_rows])
        result["explanation"] = text
        result["explanation_source"] = source
        result["graph"] = _graph_view(concept_id, overview(student_id)["concepts"])
    return result


# ---------------------------------------------------------------- quiz

QUIZZES: dict[str, dict] = {}


def _pick(pool, n, exclude=()):
    pool = [p for p in dict.fromkeys(pool) if p and p not in exclude]
    random.shuffle(pool)
    return pool[:n]


def _mcq(prompt, correct, distractors, why):
    options = [correct] + distractors[:3]
    random.shuffle(options)
    return {"prompt": prompt, "options": options, "answer": options.index(correct), "why": why}


def graph_quiz(concept_id: str) -> list[dict]:
    """Three questions built from the prerequisite graph itself."""
    f = db.ro(Q.QUIZ_FACTS, {"concept_id": concept_id})[0]
    unrelated = f["unrelated"]
    name = f["name"]
    qs = [_mcq(
        f"Which line best describes {name}?", f["summary"],
        _pick([u["summary"] for u in unrelated], 3, exclude=[f["summary"]]),
        f"{name}: {f['summary']}",
    )]
    if f["direct_before"]:
        right = random.choice(f["direct_before"])
        wrong = _pick(f["all_after"], 3) or []
        wrong += _pick([u["name"] for u in unrelated], 3 - len(wrong), exclude=wrong)
        qs.append(_mcq(f"Which topic should you understand before {name}?", right, wrong,
                       f"{right} is a direct prerequisite of {name}."))
    if f["direct_after"]:
        right = random.choice(f["direct_after"])
        wrong = _pick(f["all_before"], 3) or []
        wrong += _pick([u["name"] for u in unrelated], 3 - len(wrong), exclude=wrong)
        qs.append(_mcq(f"Which topic builds directly on {name}?", right, wrong,
                       f"{right} uses {name} as a building block."))
    while len(qs) < 3:  # top or bottom of the graph: ask about neighbours' meaning instead
        other = random.choice(unrelated)
        qs.append(_mcq(
            f"Which line best describes {other['name']}?", other["summary"],
            _pick([u["summary"] for u in unrelated], 3, exclude=[other["summary"]]),
            f"{other['name']}: {other['summary']}",
        ))
    return qs[:3]


def generate_quiz(student_id: str, concept_id: str) -> dict:
    _check_student(student_id)
    concept = get_concept(concept_id)
    questions, source = llm.quiz_questions(concept["name"], concept["summary"]), "ai"
    if not questions and concept_id in BANK:
        questions, source = [
            {"prompt": p, "options": o, "answer": a, "why": w} for p, o, a, w in BANK[concept_id]
        ], "bank"
    if not questions:
        questions, source = graph_quiz(concept_id), "graph"

    quiz_id = uuid.uuid4().hex[:12]
    QUIZZES[quiz_id] = {"student_id": student_id, "concept_id": concept_id, "questions": questions}
    if len(QUIZZES) > 500:
        QUIZZES.pop(next(iter(QUIZZES)))
    return {
        "quiz_id": quiz_id, "concept": {"id": concept["id"], "name": concept["name"]}, "source": source,
        "questions": [{"prompt": q["prompt"], "options": q["options"]} for q in questions],
    }


def submit_quiz(student_id: str, quiz_id: str, answers: list, stuck_id: str) -> dict:
    quiz = QUIZZES.get(quiz_id)
    if not quiz or quiz["student_id"] != student_id:
        raise NotFound("That quiz has expired. Start a new one.")
    concept_id = quiz["concept_id"]

    results, correct = [], 0
    for i, q in enumerate(quiz["questions"]):
        chosen = answers[i] if i < len(answers) else None
        ok = chosen == q["answer"]
        correct += ok
        results.append({"chosen": chosen, "answer": q["answer"], "correct": ok, "why": q["why"]})
    score = round(100 * correct / len(quiz["questions"]))

    before = diagnose(student_id, stuck_id, explain=False)
    update = db.run(Q.UPDATE_MASTERY, {
        "student_id": student_id, "concept_id": concept_id,
        "score": score, "date": today(), "weight": 0.6,
    })[0]
    after = diagnose(student_id, stuck_id)

    before_status = {c["id"]: (c["status"], c["score"]) for c in before["chain"]}
    changes = []
    for c in after["chain"]:
        old = before_status.get(c["id"])
        if old and (old[1] != c["score"]):
            changes.append({"id": c["id"], "name": c["name"], "before": old[0], "after": c["status"],
                            "before_score": old[1], "after_score": c["score"]})
    improved = (update["old_score"] or 0) < update["new_score"]
    del QUIZZES[quiz_id]
    return {
        "score": score, "correct": correct, "total": len(results), "results": results,
        "update": {
            "id": update["id"], "name": update["name"],
            "before_score": update["old_score"], "after_score": update["new_score"],
            "before": status_of(update["old_score"]), "after": status_of(update["new_score"]),
            "before_rel": update["old_rel"], "after_rel": update["new_rel"],
        },
        "message": ("Good one, that part is getting stronger." if improved
                    else "No wahala. That one needs a bit more time. Your plan is updated."),
        "root_changed": before["root"]["id"] != after["root"]["id"],
        "before_root": before["root"],
        "changes": changes,
        "diagnosis": after,
    }


# ---------------------------------------------------------------- overview

def overview(student_id: str) -> dict:
    student = _check_student(student_id)
    rows = db.ro(Q.STUDENT_OVERVIEW, {"student_id": student_id, "course": COURSE["code"]})
    counts = {"Weak": 0, "Okay": 0, "Strong": 0, "Not tried": 0}
    for r in rows:
        counts[r["status"]] += 1
    return {"student": {"id": student["id"], "name": student["name"]}, "counts": counts, "concepts": rows}
