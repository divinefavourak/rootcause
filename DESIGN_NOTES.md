# Design research notes (M1)

Quick scan of Pinterest/Dribbble-style references and shipped products before building the UI.

## What we took
- **Shipped beats concept shots.** Most Pinterest/Dribbble "study app" pins are unbuilt concepts that hide
  states (loading, empty, error). We design every state, and borrow structure from shipped apps.
- **Duolingo learning path.** A single vertical path of circular nodes is instantly readable on a phone.
  Duolingo moved *from* a branching tree *to* a linear path for simplicity. That validates our default
  "root line" list view (linear chain) with the branching graph as an optional toggle.
- **Headspace-style calm.** Warm off-white canvas, warm near-black text (never pure #000), generous
  rounding (20px cards, pill buttons), colour used sparingly for emphasis. Our #FAF8F3 / #1A1A1A / green +
  amber tokens sit in this family.
- **Quiz feedback.** "Knowledge of correct response" feedback (mark right/wrong *and* show the right answer)
  is the standard pattern; never signal right/wrong with colour alone, pair with a check / cross icon and text.
- **Progress at a glance.** Education dashboards that work show one summary (ring or segmented bar) above
  the detail list. One hero per screen.

## Signature
The root line: a vertical stroke through circular status nodes, stuck topic on top, root cause at the bottom
(larger, filled, amber glow). Reused in the logo, splash, loading skeleton, empty state, and progress screen.

## Sources
- https://dribbble.com/Shanto7/tags/study-app
- https://vp0.com/blogs/app-design-inspiration-pinterest
- https://blog.duolingo.com/new-duolingo-home-screen-design
- https://uxdesign.cc/down-the-wrong-path-the-disaster-of-the-latest-duolingo-ui-update-a4cdd1e6ea1c
- https://blakecrosley.com/guides/design/headspace
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8200521
