"""Every Cypher query RootCause runs lives in this file.

Each query has a plain-English comment above it. Parameters start with $.
Graph model:
  (:Course {code})-[:COVERS]->(:Concept {id, name, course, unit, aliases, summary})
  (:Concept)-[:PREREQUISITE_OF]->(:Concept)
  (:Student {id, name})-[:STRUGGLED_WITH {score, date, history}]->(:Concept)
  (:Student)-[:MASTERED {score, date, history}]->(:Concept)
"""

# Scores at or above this move a concept from STRUGGLED_WITH to MASTERED.
MASTERY_THRESHOLD = 60

# How far back we are willing to walk from the stuck concept.
MAX_HOPS = 12


# ---------------------------------------------------------------------------
# Seeding (run once by scripts/seed.py)
# ---------------------------------------------------------------------------

# Make lookups by id fast for concepts and students.
CREATE_CONCEPT_ID_INDEX = "CREATE INDEX FOR (c:Concept) ON (c.id)"
CREATE_STUDENT_ID_INDEX = "CREATE INDEX FOR (s:Student) ON (s.id)"

# Build a full-text (RediSearch) index over each concept's name and aliases,
# with English stemming, so "flip flops", "k map" or "karnaugh" all find a concept.
CREATE_CONCEPT_FULLTEXT_INDEX = (
    "CALL db.idx.fulltext.createNodeIndex({label: 'Concept', language: 'english'}, 'name', 'aliases')"
)

# Create the course node.
CREATE_COURSE = "MERGE (c:Course {code: $code}) SET c.title = $title"

# Create every concept and link it to the course that covers it.
CREATE_CONCEPTS = """
MATCH (course:Course {code: $code})
UNWIND $concepts AS row
MERGE (c:Concept {id: row.id})
SET c.name = row.name, c.unit = row.unit, c.aliases = row.aliases,
    c.summary = row.summary, c.course = $code
MERGE (course)-[:COVERS]->(c)
"""

# Draw the prerequisite arrows: (before)-[:PREREQUISITE_OF]->(after).
CREATE_PREREQUISITES = """
UNWIND $edges AS edge
MATCH (before:Concept {id: edge[0]}), (after:Concept {id: edge[1]})
MERGE (before)-[:PREREQUISITE_OF]->(after)
"""

# Create the demo students.
CREATE_STUDENTS = """
UNWIND $students AS row
MERGE (s:Student {id: row.id})
SET s.name = row.name, s.blurb = row.blurb
"""


# ---------------------------------------------------------------------------
# Lookups used by the API
# ---------------------------------------------------------------------------

# List the demo students with how many concepts they are weak or strong in.
LIST_STUDENTS = """
MATCH (s:Student)
OPTIONAL MATCH (s)-[w:STRUGGLED_WITH]->(:Concept)
WITH s, count(w) AS weak
OPTIONAL MATCH (s)-[m:MASTERED]->(:Concept)
RETURN s.id AS id, s.name AS name, s.blurb AS blurb, weak, count(m) AS mastered
ORDER BY name
"""

# List every concept in the course, with how many direct prerequisites it has.
LIST_CONCEPTS = """
MATCH (:Course {code: $course})-[:COVERS]->(c:Concept)
OPTIONAL MATCH (pre:Concept)-[:PREREQUISITE_OF]->(c)
RETURN c.id AS id, c.name AS name, c.unit AS unit, count(pre) AS prerequisites
ORDER BY unit, name
"""

# Fetch one concept by id.
GET_CONCEPT = """
MATCH (c:Concept {id: $concept_id})
RETURN c.id AS id, c.name AS name, c.unit AS unit, c.summary AS summary
"""

# The prerequisite neighbourhood around a concept (for the optional graph view):
# every edge where both ends are within two steps upstream of the concept.
CONCEPT_NEIGHBOURHOOD = """
MATCH (focus:Concept {id: $concept_id})
MATCH (a:Concept)-[:PREREQUISITE_OF*0..2]->(focus)
WITH collect(DISTINCT a) AS near
UNWIND near AS x
MATCH (x)-[:PREREQUISITE_OF]->(y)
WHERE y IN near
RETURN x.id AS source, y.id AS target
"""


# ---------------------------------------------------------------------------
# Core query 1: root_cause
# ---------------------------------------------------------------------------

# Walk backwards along PREREQUISITE_OF from the concept the student is stuck on,
# reaching every ancestor (0 hops = the stuck concept itself). Keep the shortest
# hop count to each ancestor and join the student's latest score.
# Candidates are ancestors the student STRUGGLED_WITH. Rank them by lowest score
# first, then by fewest hops (closer = more directly to blame). The stuck concept
# itself is only picked if no weaker prerequisite exists.
ROOT_CAUSE = f"""
MATCH (s:Student {{id: $student_id}}), (stuck:Concept {{id: $concept_id}})
MATCH p = (anc:Concept)-[:PREREQUISITE_OF*0..{MAX_HOPS}]->(stuck)
WITH s, anc, min(length(p)) AS hops
OPTIONAL MATCH (s)-[r:STRUGGLED_WITH|MASTERED]->(anc)
WITH anc, hops, r
WHERE hops = 0 OR type(r) = 'STRUGGLED_WITH'
RETURN anc.id AS id, anc.name AS name, anc.summary AS summary,
       r.score AS score, type(r) AS rel, hops
ORDER BY CASE WHEN hops = 0 THEN 1 ELSE 0 END, coalesce(r.score, 101) ASC, hops ASC
LIMIT 1
"""

# The chain from the root cause up to the stuck concept. Among all shortest
# prerequisite paths between them, prefer the one through the weakest concepts
# (lowest average score; untried concepts count as 60). Return each step on that
# path with the student's score and status, root first.
ROOT_CHAIN = f"""
MATCH (s:Student {{id: $student_id}}),
      (root:Concept {{id: $root_id}}), (stuck:Concept {{id: $concept_id}})
MATCH p = (root)-[:PREREQUISITE_OF*0..{MAX_HOPS}]->(stuck)
WITH s, p,
     [n IN nodes(p) | coalesce(head([(s)-[r:STRUGGLED_WITH|MASTERED]->(n) | r.score]), 60)] AS scores
WITH s, p, reduce(total = 0.0, x IN scores | total + x) / size(scores) AS avg_score
ORDER BY length(p) ASC, avg_score ASC
LIMIT 1
UNWIND range(0, length(p)) AS i
WITH s, i, nodes(p)[i] AS n
OPTIONAL MATCH (s)-[r:STRUGGLED_WITH|MASTERED]->(n)
RETURN i AS step, n.id AS id, n.name AS name, r.score AS score, type(r) AS rel
ORDER BY step
"""


# ---------------------------------------------------------------------------
# Core query 2: update_mastery
# ---------------------------------------------------------------------------

# Record a new score for a student on a concept. Find the old STRUGGLED_WITH or
# MASTERED edge (if any), remember its score and history, and delete it. Blend the
# old and new score ($weight = how much the new score counts; 1.0 = replace).
# Then MERGE exactly one new edge: MASTERED if the blended score is 60 or more,
# otherwise STRUGGLED_WITH. Return the before and after so the UI can show change.
UPDATE_MASTERY = f"""
MATCH (s:Student {{id: $student_id}}), (c:Concept {{id: $concept_id}})
OPTIONAL MATCH (s)-[old:STRUGGLED_WITH|MASTERED]->(c)
WITH s, c, old, type(old) AS old_rel, old.score AS old_score,
     coalesce(old.history, []) AS history
WITH s, c, old, old_rel, old_score, history,
     CASE WHEN old_score IS NULL THEN $score
          ELSE toInteger(round(old_score * (1 - $weight) + $score * $weight)) END AS new_score
DELETE old
WITH s, c, old_rel, old_score, history + [new_score] AS history, new_score
FOREACH (_ IN CASE WHEN new_score >= {MASTERY_THRESHOLD} THEN [1] ELSE [] END |
    MERGE (s)-[m:MASTERED]->(c)
    SET m.score = new_score, m.date = $date, m.history = history)
FOREACH (_ IN CASE WHEN new_score < {MASTERY_THRESHOLD} THEN [1] ELSE [] END |
    MERGE (s)-[w:STRUGGLED_WITH]->(c)
    SET w.score = new_score, w.date = $date, w.history = history)
RETURN c.id AS id, c.name AS name, old_rel, old_score, new_score,
       CASE WHEN new_score >= {MASTERY_THRESHOLD} THEN 'MASTERED' ELSE 'STRUGGLED_WITH' END AS new_rel
"""


# ---------------------------------------------------------------------------
# Core query 3: fix_plan
# ---------------------------------------------------------------------------

# Every ancestor of the stuck concept that the student STRUGGLED_WITH, ordered
# deepest first (the longest prerequisite path back to the stuck concept, so
# foundations come before what is built on them), weakest first within the same
# depth. The stuck concept goes last. The ordered list is then split into 3 days
# in order: step i of N goes to day 1 + floor(3i / N).
FIX_PLAN = f"""
MATCH (s:Student {{id: $student_id}}), (stuck:Concept {{id: $concept_id}})
OPTIONAL MATCH p = (anc:Concept)-[:PREREQUISITE_OF*1..{MAX_HOPS}]->(stuck)
WHERE (s)-[:STRUGGLED_WITH]->(anc)
WITH s, stuck, anc, max(length(p)) AS depth
OPTIONAL MATCH (s)-[r:STRUGGLED_WITH]->(anc)
WITH s, stuck, anc, depth, r
ORDER BY depth DESC, r.score ASC
WITH s, stuck,
     [x IN collect({{id: anc.id, name: anc.name, summary: anc.summary, score: r.score, depth: depth}})
      WHERE x.id IS NOT NULL] AS weak
OPTIONAL MATCH (s)-[sr:STRUGGLED_WITH|MASTERED]->(stuck)
WITH weak[0..{8}] + [{{id: stuck.id, name: stuck.name, summary: stuck.summary, score: sr.score, depth: 0}}] AS steps
UNWIND range(0, size(steps) - 1) AS i
RETURN 1 + toInteger(floor(i * 3.0 / size(steps))) AS day, i AS position,
       steps[i].id AS id, steps[i].name AS name, steps[i].summary AS summary,
       steps[i].score AS score, steps[i].depth AS depth
ORDER BY position
"""


# ---------------------------------------------------------------------------
# Core query 4: student_overview
# ---------------------------------------------------------------------------

# Every concept in the course with this student's status:
# Weak (under 50), Okay (50 to 69), Strong (70 and up) or Not tried (no edge).
# Also counts how many later concepts depend on it, downstream through
# PREREQUISITE_OF, so the UI can say "unlocks 12 topics".
STUDENT_OVERVIEW = """
MATCH (s:Student {id: $student_id})
MATCH (:Course {code: $course})-[:COVERS]->(c:Concept)
OPTIONAL MATCH (s)-[r:STRUGGLED_WITH|MASTERED]->(c)
OPTIONAL MATCH (c)-[:PREREQUISITE_OF*1..12]->(later:Concept)
WITH c, r, count(DISTINCT later) AS unlocks
RETURN c.id AS id, c.name AS name, c.unit AS unit, r.score AS score,
       r.date AS date, r.history AS history, unlocks,
       CASE WHEN r IS NULL THEN 'Not tried'
            WHEN r.score < 50 THEN 'Weak'
            WHEN r.score < 70 THEN 'Okay'
            ELSE 'Strong' END AS status
ORDER BY c.unit, c.name
"""


# ---------------------------------------------------------------------------
# Core query 5: resolve_concept
# ---------------------------------------------------------------------------

# Search the full-text index over concept name and aliases. Keep the top 3 hits.
# Confidence: an exact name or alias match is 0.98. Otherwise a hit's share of the
# top 3 scores (a single fuzzy hit gets 0.8), so a clear winner scores high and
# three close guesses score low.
RESOLVE_CONCEPT = """
CALL db.idx.fulltext.queryNodes('Concept', $search) YIELD node, score
WITH node, score
ORDER BY score DESC
LIMIT 3
WITH collect(node) AS nodes, collect(score) AS scores
WITH nodes, scores, reduce(total = 0.0, x IN scores | total + x) AS total
UNWIND range(0, size(nodes) - 1) AS i
WITH nodes[i] AS c, scores[i] AS raw, total, size(nodes) AS hits,
     (toLower(nodes[i].name) = $plain OR $plain IN split(toLower(nodes[i].aliases), ', ')) AS exact
RETURN c.id AS id, c.name AS name, c.unit AS unit, raw, exact,
       CASE WHEN exact THEN 0.98
            WHEN hits = 1 THEN 0.8
            ELSE raw / total END AS confidence
ORDER BY exact DESC, raw DESC
"""
