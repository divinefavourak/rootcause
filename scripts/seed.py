"""Reset the FalkorDB graph and load the synthetic IFT 211 course.

Run from the repo root:  python -m scripts.seed
"""
from app import db, queries as Q
from app.notes_data import NOTES
from app.seed_data import CONCEPTS, COURSE, PREREQUISITES, STUDENTS


def main() -> None:
    g = db.graph()
    try:
        g.delete()  # drops nodes, edges and indexes in one go
    except Exception:
        pass  # graph did not exist yet

    db.run(Q.CREATE_COURSE, COURSE)
    db.run(Q.CREATE_CONCEPT_ID_INDEX)
    db.run(Q.CREATE_STUDENT_ID_INDEX)
    db.run(Q.CREATE_CONCEPT_FULLTEXT_INDEX)

    concepts = []
    for cid, name, unit, aliases, summary in CONCEPTS:
        points, example, trap = NOTES.get(cid, (None, None, None))
        concepts.append({"id": cid, "name": name, "unit": unit, "aliases": aliases, "summary": summary,
                         "note_points": points, "note_example": example, "note_trap": trap})
    db.run(Q.CREATE_CONCEPTS, {"code": COURSE["code"], "concepts": concepts})
    db.run(Q.CREATE_PREREQUISITES, {"edges": [list(e) for e in PREREQUISITES]})
    db.run(Q.CREATE_STUDENTS, {"students": [
        {"id": s["id"], "name": s["name"], "blurb": s["blurb"]} for s in STUDENTS
    ]})

    # Replay each student's history through the same memory query the quiz uses.
    # weight=1.0 means each historical score replaces the last (no blending).
    attempts = 0
    for student in STUDENTS:
        for concept_id, history in student["history"].items():
            for date, score in history:
                db.run(Q.UPDATE_MASTERY, {
                    "student_id": student["id"], "concept_id": concept_id,
                    "score": score, "date": date, "weight": 1.0,
                })
                attempts += 1

    counts = db.ro("""
        MATCH (c:Concept) WITH count(c) AS concepts
        MATCH ()-[p:PREREQUISITE_OF]->() WITH concepts, count(p) AS prereqs
        MATCH (s:Student) WITH concepts, prereqs, count(s) AS students
        MATCH ()-[r:STRUGGLED_WITH|MASTERED]->()
        RETURN concepts, prereqs, students, count(r) AS score_edges
    """)[0]
    print(f"Seeded {COURSE['code']}: {counts['concepts']} concepts, "
          f"{counts['prereqs']} prerequisite edges, {counts['students']} students, "
          f"{counts['score_edges']} score edges from {attempts} attempts.")


if __name__ == "__main__":
    main()
