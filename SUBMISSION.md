# RootCause

**Find the real reason a topic feels hard.**

Track: **Agent Memory and Coordination**

- Live app: https://rootcause-production-b767.up.railway.app
- Code: https://github.com/divinefavourak/rootcause
- Demo video: `demo/rootcause-launch.mp4` in the repo

## The problem

When a student says "I don't get flip-flops", the usual fix is more flip-flop videos. But flip-flops are
rarely the real problem. They're built on latches, latches are built on NAND and NOR gates, and those only
make sense once De Morgan's theorems click. The weakness is usually a few steps underneath the topic the
student is stuck on. A list of scores can tell you a student failed a topic. It can't tell you *why*.

## What RootCause does

1. The student types or says the topic they're stuck on, in their own words ("k map", "demorgans", "the mux
   thing" all work).
2. RootCause walks **backwards through a prerequisite graph** of the course and checks the student's own
   scores at every step. It returns the weakest foundation (the root cause) and the chain that connects it
   to the stuck topic.
3. It builds a **3-day plan** that starts at the deepest weak foundation, with study notes (key points, a
   worked example, the usual trap) for every topic.
4. A 3-question quiz on the root cause **writes the result back into the graph**. The diagnosis re-runs
   immediately and moves on to the next weakest link.

Demo: student Tobi is stuck on Flip-Flops. RootCause traces Flip-Flops → D Latch → SR Latch → NAND and NOR
Gates → **De Morgan's Theorems (35%)**. After a 3/3 quiz, De Morgan moves from Weak 35% to Strong 74%, and
the next diagnosis points at **SR Latch (42%)**.

## Why a graph (and why this track)

FalkorDB is the only database, and the graph does the work:

- **Diagnosis** is a variable-length Cypher traversal backwards along `PREREQUISITE_OF` (up to 12 hops),
  joined with the student's `STRUGGLED_WITH` / `MASTERED` edges. Lowest score wins; ties go to the closer
  ancestor.
- **The chain** is the shortest prerequisite path from the root cause to the stuck topic, choosing the path
  through the weakest concepts.
- **The plan** is every weak ancestor, ordered by depth so foundations come first, split into 3 days in
  Cypher.
- **Memory is the edges.** A quiz deletes the old edge and MERGEs exactly one new one (`MASTERED` at 60% or
  more, otherwise `STRUGGLED_WITH`), blending the old and new score and keeping a score history. The next
  traversal sees the change instantly. Study notes written by the AI are saved back onto the concept nodes,
  so the graph is also the agent's long-term memory.
- **Topic matching** uses FalkorDB's full-text index (English stemming, fuzzy and prefix terms) over concept
  names and spoken-form aliases, with a confidence score that decides between auto-select and "Did you
  mean...?".
- **The Root map** draws the stuck topic's whole upstream root system (21 topics for Flip-Flops) from two
  more traversals.

Every Cypher query lives in one file, `app/queries.py`, with a plain-English comment above each one.

The course is a synthetic IFT 211 Digital Logic graph: 56 concepts, 83 prerequisite links, two made-up
students with score history. No real personal data.

## The AI's role

The graph decides; the AI only explains. Facts from the traversal (root cause, score, chain) go to a fast
model (Groq, `openai/gpt-oss-120b`; OpenRouter as a fallback), which writes a short, friendly explanation
in the voice of an older student ("no wahala"). AI calls never block the student: the result shows at once
with a template sentence and the AI text swaps in when it arrives (about 1.5s). Every AI feature has a
fallback (templates, a hand-written question bank, questions and notes built from the graph), so the app
works with no key at all.

## Built for real students

- Mobile-first installable PWA that works offline (it keeps the last result).
- Voice in (Web Speech API, en-NG first, never auto-submits) and Listen buttons that read diagnoses, plans
  and questions aloud. No audio is ever stored or sent; only the final text reaches the server.
- Accessibility: the chain is a real ordered list, status is always icon plus text (never colour alone),
  48px touch targets, keyboard navigation, reduced-motion and dark-mode support. Lighthouse Accessibility
  100.
- Share the diagnosis and plan to WhatsApp in one tap.
- Neobrutalist design with a three.js 3D hero and an interactive, full-screen Root map.

## Stack

FalkorDB (graph + full-text index), FastAPI, vanilla HTML/CSS/JS, three.js, Groq / OpenRouter, one Docker
container on Railway with FalkorDB persisted to a volume.

## Built with Claude Code

This project was built with Claude Code as a pair programmer: it wrote most of the code, the seed data, the
Cypher queries and the docs under my direction, ran the tests and the screenshot and Lighthouse QA loops,
and produced the demo video. I set the product direction and reviewed the design and every decision.
