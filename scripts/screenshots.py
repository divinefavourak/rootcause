"""Capture every screen and state at 4 viewports x 2 themes into /screenshots.

Needs the app running (uvicorn app.main:app --port 8000) and a freshly seeded graph.
Run from the repo root:  python -m scripts.screenshots [--quick]
--quick: only 360px light + dark (for fast design iterations).
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from scripts import seed

BASE = "http://127.0.0.1:8000"
OUT = Path(__file__).resolve().parent.parent / "screenshots"
VIEWPORTS = [(360, 800), (390, 844), (768, 1024), (1280, 800)]
LONG_NAME = "Arithmetic Logic Unit (ALU) with an extremely long descriptive concept name for overflow testing"


def shoot(page, name, w, theme, full=True):
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / f"{name}_{w}_{theme}.png"), full_page=full)
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    if overflow > 0:
        print(f"  !! horizontal overflow {overflow}px on {name} at {w}px ({theme})")


def run(viewports, themes):
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for w, h in viewports:
            for theme in themes:
                seed.main()
                ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme=theme,
                                          device_scale_factor=1, service_workers="block")
                page = ctx.new_page()
                page.goto(BASE)
                page.wait_for_timeout(1300)  # splash
                shoot(page, "01_picker", w, theme)
                page.click("[data-student=tobi]")
                shoot(page, "02_home_empty", w, theme)

                page.fill("#topic", "k mapp")
                page.click("#findBtn")
                page.wait_for_selector(".rc-card, #suggest .chip", timeout=15000)
                page.wait_for_timeout(900)
                page.evaluate("window.scrollTo(0,0)")
                if page.query_selector("#suggest .chip") and not page.query_selector(".rc-card"):
                    shoot(page, "03_did_you_mean", w, theme, full=False)

                page.fill("#topic", "I don't get flip flops")
                page.click("#findBtn")
                page.wait_for_selector(".rc-card", timeout=15000)
                page.wait_for_timeout(1600)
                shoot(page, "04_diagnosis", w, theme)

                page.click("[data-chainview=graph]")
                shoot(page, "05_graph_view", w, theme)
                page.click("[data-chainview=list]")

                page.goto(BASE + "/#plan")
                page.wait_for_timeout(500)
                page.click("#planBody .tick")
                shoot(page, "06_plan", w, theme)

                page.goto(BASE + "/#home")
                page.wait_for_selector("[data-action=quiz]")
                page.click(".rc-actions [data-action=quiz]")
                page.wait_for_selector(".opt", timeout=20000)
                shoot(page, "07_quiz_question", w, theme, full=False)
                page.click("[data-opt='1']")
                shoot(page, "08_quiz_selected", w, theme, full=False)
                page.click("[data-action=qnext]")
                page.click("[data-opt='0']")
                page.click("[data-action=qnext]")
                page.click("[data-opt='2']")
                page.click("[data-action=qsubmit]")
                page.wait_for_selector("[data-action=seechange]", timeout=20000)
                shoot(page, "09_quiz_review", w, theme)
                page.click("[data-action=seechange]")
                page.wait_for_timeout(700)
                shoot(page, "10_healing", w, theme, full=False)
                page.wait_for_timeout(2400)
                shoot(page, "11_after_quiz", w, theme)

                page.goto(BASE + "/#progress")
                page.wait_for_selector(".crow", timeout=15000)
                shoot(page, "12_progress", w, theme)

                # long-name overflow test
                page.evaluate("""(n) => { document.querySelectorAll('.crow-name').forEach((e, i) => { if (i < 2) e.firstChild.textContent = n; }); }""", LONG_NAME)
                shoot(page, "13_long_name", w, theme, full=False)

                page.evaluate("localStorage.clear()")
                page.goto(BASE + "/")
                page.wait_for_timeout(1300)
                page.click("[data-student=amaka]")
                page.goto(BASE + "/#plan")
                page.wait_for_timeout(300)
                shoot(page, "14_plan_empty", w, theme, full=False)

                ctx.set_offline(True)
                page.evaluate("window.dispatchEvent(new Event('offline'))")
                shoot(page, "15_offline", w, theme, full=False)
                ctx.close()
        browser.close()


if __name__ == "__main__":
    quick = "--quick" in sys.argv
    run(VIEWPORTS[:1] if quick else VIEWPORTS, ["light", "dark"])
    print("screenshots in", OUT)
