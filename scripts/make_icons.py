"""Render app/static/icons/icon.svg to the PNG sizes the PWA needs, plus the og:image.

Run from the repo root:  python -m scripts.make_icons
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ICONS = Path(__file__).resolve().parent.parent / "app" / "static" / "icons"
SVG = (ICONS / "icon.svg").read_text(encoding="utf-8")

# Maskable: full-bleed green so launchers can crop to any shape; the mark sits in the 80% safe zone.
MASKABLE = SVG.replace('rx="112"', 'rx="0"').replace(
    '<path', '<g transform="translate(51 51) scale(.8)"><path', 1).replace("</svg>", "</g></svg>")

OG = f"""<html><body style="margin:0;width:1200px;height:630px;background:#FAF8F3;display:flex;align-items:center;
font-family:ui-rounded,'SF Pro Rounded','Segoe UI',system-ui,sans-serif;color:#1A1A1A">
<div style="width:1200px;padding:0 96px;display:flex;align-items:center;gap:72px;box-sizing:border-box">
  <div style="width:300px;height:300px;flex:none">{SVG.replace('<svg ', '<svg width="300" height="300" ')}</div>
  <div>
    <div style="font-size:84px;font-weight:800;color:#0B5D3B;letter-spacing:-2px">RootCause</div>
    <div style="font-size:42px;font-weight:600;line-height:1.25;margin-top:16px">Stuck on a topic? Find the weak<br>foundation underneath, then fix it<br>in 3 days.</div>
    <div style="font-size:28px;color:#5B5B55;margin-top:24px">IFT 211 Digital Logic study agent</div>
  </div>
</div></body></html>"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for name, size, svg in [
            ("icon-192.png", 192, SVG), ("icon-512.png", 512, SVG), ("icon-maskable-512.png", 512, MASKABLE),
            ("apple-touch-icon.png", 180, MASKABLE), ("favicon-32.png", 32, SVG),
        ]:
            page.set_viewport_size({"width": size, "height": size})
            page.set_content(f'<html><body style="margin:0;background:transparent">'
                             f'{svg.replace("<svg ", f"<svg width={size} height={size} ")}</body></html>')
            page.screenshot(path=str(ICONS / name), omit_background=True, clip={"x": 0, "y": 0, "width": size, "height": size})
        page.set_viewport_size({"width": 1200, "height": 630})
        page.set_content(OG)
        page.screenshot(path=str(ICONS / "og.png"))
        browser.close()
    print("icons written to", ICONS)


if __name__ == "__main__":
    main()
