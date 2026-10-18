"""Exercise the five core queries against a throwaway copy of the graph.

Run from the repo root:  python -m scripts.test_queries
Seeds a separate graph (rootcause_test), prints every result, then deletes it.
"""
import os

os.environ["FALKORDB_GRAPH"] = "rootcause_test"

from app import db, services  # noqa: E402
from scripts import seed  # noqa: E402

failures = 0


def check(label, condition):
    global failures
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}")
    failures += not condition


def show_diagnosis(d):
    print(f"  root cause: {d['root']['name']} ({d['root']['score']}%, {d['root']['hops']} hops back)")
    print("  chain (top = stuck):")
    for c in d["chain"]:
        tag = "  <- ROOT" if c["is_root"] else ""
        print(f"    {c['name']:<32} {str(c['score']) + '%':>5}  {c['status']}{tag}")
    print("  3-day plan:")
    for day in d["plan"]:
        print(f"    Day {day['day']} ({day['minutes']} min): " + ", ".join(i["name"] for i in day["items"]))


def main():
    seed.main()

    print("\n5. resolve_concept")
    for text in ["I don't get flip flops", "k map", "karnaugh", "demorgans law", "the mux thing",
                 "twos compliment", "state machine", "xyzzy"]:
        r = services.resolve_concept(text)
        top = ", ".join(f"{m['name']} ({m['confidence']})" for m in r["matches"]) or "no match"
        print(f"  {text!r:<28} -> {top}{'  [confident]' if r['confident'] else ''}")
    check("'flip flops' resolves to Flip-Flops", services.resolve_concept("flip flops")["best"]["id"] == "flip_flops")
    check("'k map' resolves to Karnaugh Maps", services.resolve_concept("k map")["best"]["id"] == "kmaps")
    check("nonsense gives no match", not services.resolve_concept("xyzzy")["matches"])

    print("\n1+3. root_cause + fix_plan: Tobi stuck on Flip-Flops")
    d = services.diagnose("tobi", "flip_flops", explain=False)
    show_diagnosis(d)
    check("root cause is De Morgan's Theorems", d["root"]["id"] == "de_morgan")
    check("chain runs from stuck (top) to root (bottom)", d["chain"][0]["is_stuck"] and d["chain"][-1]["is_root"])
    check("plan spans exactly 3 days", [p["day"] for p in d["plan"]] == [1, 2, 3])
    check("plan ends with the stuck topic", d["plan"][-1]["items"][-1]["id"] == "flip_flops")

    print("\n1+3. Amaka stuck on Karnaugh Maps")
    d = services.diagnose("amaka", "kmaps", explain=False)
    show_diagnosis(d)
    check("root cause is Gray Code", d["root"]["id"] == "gray_code")

    print("\n1. Amaka stuck on Number Systems (no prerequisites -> the topic itself)")
    d = services.diagnose("amaka", "number_systems", explain=False)
    check("root falls back to the stuck concept", d["root"]["is_self"])

    print("\n2. update_mastery: Tobi aces a De Morgan quiz")
    quiz = services.generate_quiz("tobi", "de_morgan")
    print(f"  quiz source: {quiz['source']}, {len(quiz['questions'])} questions")
    answers = [q["answer"] for q in services.QUIZZES[quiz["quiz_id"]]["questions"]]
    res = services.submit_quiz("tobi", quiz["quiz_id"], answers, "flip_flops")
    u = res["update"]
    print(f"  {u['name']}: {u['before_score']}% {u['before_rel']} -> {u['after_score']}% {u['after_rel']}")
    print(f"  root changed: {res['root_changed']}  ->  new root: {res['diagnosis']['root']['name']}")
    for c in res["changes"]:
        print(f"  change: {c['name']} {c['before']} -> {c['after']}")
    check("relationship switched STRUGGLED_WITH -> MASTERED", u["before_rel"] == "STRUGGLED_WITH" and u["after_rel"] == "MASTERED")
    check("old edge removed (exactly one edge left)", len(db.ro(
        "MATCH (:Student {id:'tobi'})-[r]->(:Concept {id:'de_morgan'}) RETURN count(r) AS n")) and db.ro(
        "MATCH (:Student {id:'tobi'})-[r]->(:Concept {id:'de_morgan'}) RETURN count(r) AS n")[0]["n"] == 1)
    check("next diagnosis moves on to the next weakest link (SR Latch, 42%)", res["diagnosis"]["root"]["id"] == "sr_latch")

    print("\n2. update_mastery: a 0/3 quiz keeps it STRUGGLED_WITH")
    quiz = services.generate_quiz("amaka", "gray_code")
    res = services.submit_quiz("amaka", quiz["quiz_id"], [None, None, None], "kmaps")
    print(f"  {res['update']['name']}: {res['update']['before_score']}% -> {res['update']['after_score']}% ({res['update']['after_rel']})")
    check("still STRUGGLED_WITH", res["update"]["after_rel"] == "STRUGGLED_WITH")

    print("\n4. student_overview")
    for sid in ("tobi", "amaka"):
        o = services.overview(sid)
        print(f"  {o['student']['name']}: {o['counts']}")
        check(f"{sid}: all 56 concepts listed", len(o["concepts"]) == 56)
    top = sorted(services.overview("tobi")["concepts"], key=lambda c: -c["unlocks"])[:3]
    print("  most load-bearing concepts:", ", ".join(f"{c['name']} (unlocks {c['unlocks']})" for c in top))

    print("\ngraph-built quiz (no LLM, no bank) for Multiplexers:")
    for q in services.graph_quiz("multiplexer"):
        print(f"  Q: {q['prompt']}\n     " + " | ".join(("*" if i == q["answer"] else "") + o for i, o in enumerate(q["options"])))

    db.graph().delete()
    print(f"\n{'ALL CHECKS PASSED' if not failures else f'{failures} CHECK(S) FAILED'}")
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
