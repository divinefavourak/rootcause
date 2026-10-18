"""Blog images: hand-written SVG diagrams exported to PNG (Medium does not accept SVG uploads)."""
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
INK, CREAM, GREEN, MINT, AMBER, RED = "#141414", "#FAF8F3", "#0B5D3B", "#4CE38A", "#F5B700", "#C62A2F"
FONT = "font-family=\"ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif\""


def card(x, y, w, h, title, status, score, fill="#FFFFFF", tag=None, tag_fill=RED, rotate=0, dark_text=INK):
    sph = {"Weak": ("#FFC9C2", "#E5484D"), "Strong": ("#B9F2D2", "#12A15E")}.get(status, ("#FFFFFF", "#BDB7AA"))
    gid = f"g{abs(hash((x, y, title))) % 10**6}"
    t = f'<g transform="rotate({rotate} {x + w / 2} {y + h / 2})">'
    t += f'<rect x="{x + 6}" y="{y + 8}" width="{w}" height="{h}" rx="22" fill="{INK}"/>'
    t += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{fill}" stroke="{INK}" stroke-width="3"/>'
    t += f'<defs><radialGradient id="{gid}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="{sph[0]}"/><stop offset="1" stop-color="{sph[1]}"/></radialGradient></defs>'
    t += f'<circle cx="{x + 30}" cy="{y + 32}" r="13" fill="url(#{gid})" stroke="{INK}" stroke-width="2.5"/>'
    t += f'<text x="{x + 52}" y="{y + 39}" font-size="20" font-weight="800" fill="{dark_text}" {FONT}>{status}</text>'
    t += f'<rect x="{x + w - 86}" y="{y + 16}" width="68" height="32" rx="16" fill="rgba(0,0,0,.08)"/>'
    t += f'<text x="{x + w - 52}" y="{y + 39}" font-size="19" font-weight="850" text-anchor="middle" fill="{dark_text}" {FONT}>{score}</text>'
    t += f'<text x="{x + 20}" y="{y + 80}" font-size="25" font-weight="900" fill="{dark_text}" {FONT}>{title}</text>'
    if tag:
        tw = 22 + len(tag) * 10.5
        t += f'<rect x="{x + 16}" y="{y - 16}" width="{tw}" height="30" rx="15" fill="{tag_fill}" stroke="{INK}" stroke-width="2"/>'
        t += f'<text x="{x + 16 + tw / 2}" y="{y + 5}" font-size="16" font-weight="900" text-anchor="middle" fill="#FFFFFF" {FONT}>{tag}</text>'
    return t + "</g>"


def wire(x1, y1, x2, y2, color=MINT):
    mid = (y1 + y2) / 2
    return (f'<path d="M{x1} {y1} V{mid} H{x2} V{y2}" fill="none" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 10"/>'
            f'<circle cx="{x1}" cy="{y1}" r="6" fill="{color}"/><circle cx="{x2}" cy="{y2}" r="6" fill="{color}"/>')


def dark_bg(w, h):
    return (f'<defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#353535"/></pattern></defs>'
            f'<rect width="{w}" height="{h}" fill="#101010"/><rect width="{w}" height="{h}" fill="url(#dots)"/>')


def chain_svg():
    W, H = 1400, 900
    s = dark_bg(W, H)
    s += f'<text x="80" y="140" font-size="58" font-weight="900" fill="#F2F0EA" {FONT}>Walking back</text>'
    s += f'<text x="80" y="210" font-size="58" font-weight="900" fill="#F2F0EA" {FONT}>from the stuck topic</text>'
    s += f'<text x="80" y="290" font-size="27" font-weight="650" fill="#BDBDBD" {FONT}>Each step checks the student\'s own score.</text>'
    s += f'<text x="80" y="330" font-size="27" font-weight="650" fill="#BDBDBD" {FONT}>Lowest score wins. Ties go to the closer one.</text>'
    s += f'<text x="80" y="520" font-size="150" font-weight="900" fill="{AMBER}" {FONT}>4</text>'
    s += f'<text x="190" y="520" font-size="36" font-weight="800" fill="#F2F0EA" {FONT}>steps down</text>'
    xs, y0, step, w, h = [760, 840, 840, 760, 760], 70, 160, 380, 104
    names = [("Flip-Flops", "30%"), ("D Latch", "48%"), ("SR Latch", "42%"), ("NAND and NOR Gates", "45%"), ("De Morgan's Theorems", "35%")]
    for i in range(4):
        s += wire(xs[i] + w / 2, y0 + i * step + h, xs[i + 1] + w / 2, y0 + (i + 1) * step)
    for i, (n, sc) in enumerate(names):
        root = i == 4
        s += card(xs[i], y0 + i * step, w, h, n, "Weak", sc, fill=MINT if root else "#FFFFFF",
                  tag="Root cause" if root else ("You're stuck here" if i == 0 else None),
                  tag_fill=RED if root else INK, rotate=-3 if root else 0)
    return W, H, s


def model_svg():
    W, H = 1400, 820
    s = f'<rect width="{W}" height="{H}" fill="{CREAM}"/>'
    s += f'<text x="80" y="110" font-size="56" font-weight="900" fill="{INK}" {FONT}>The graph behind RootCause</text>'

    def node(cx, cy, label, sub, fill):
        return (f'<rect x="{cx - 150 + 7}" y="{cy - 60 + 8}" width="300" height="120" rx="60" fill="{INK}"/>'
                f'<rect x="{cx - 150}" y="{cy - 60}" width="300" height="120" rx="60" fill="{fill}" stroke="{INK}" stroke-width="4"/>'
                f'<text x="{cx}" y="{cy + 2}" font-size="36" font-weight="900" text-anchor="middle" fill="{INK}" {FONT}>{label}</text>'
                f'<text x="{cx}" y="{cy + 36}" font-size="20" font-weight="700" text-anchor="middle" fill="{INK}" opacity=".7" {FONT}>{sub}</text>')

    def edge(x1, y1, x2, y2, label, color=INK, dy=-14):
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        lw = 30 + len(label) * 12
        return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="5" marker-end="url(#arr)"/>'
                f'<rect x="{mx - lw / 2}" y="{my + dy - 26}" width="{lw}" height="38" rx="19" fill="#FFFFFF" stroke="{INK}" stroke-width="3"/>'
                f'<text x="{mx}" y="{my + dy}" font-size="20" font-weight="900" text-anchor="middle" fill="{INK}" {FONT}>{label}</text>')

    s += f'<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{INK}"/></marker></defs>'
    s += edge(330, 300, 520, 410, "COVERS")
    s += edge(1030, 450, 852, 450, "PREREQUISITE_OF", dy=62)
    s += edge(1110, 250, 860, 400, "STRUGGLED_WITH")
    s += edge(1110, 650, 860, 500, "MASTERED")
    s += node(230, 250, "Course", "IFT 211", "#FFFFFF")
    s += node(700, 450, "Concept", "56 topics", AMBER)
    s += node(1180, 450, "Concept", "aliases, notes", "#FFF3C4")
    s += node(1180, 200, "Student", "score, history", "#C9BFF7")
    s += node(1180, 700, "Student", "score, history", "#C9F5DC")
    s += f'<text x="80" y="760" font-size="26" font-weight="700" fill="#5B5B55" {FONT}>83 prerequisite links. Memory lives on the student edges.</text>'
    return W, H, s


def memory_svg():
    W, H = 1400, 760
    s = f'<rect width="{W}" height="{H}" fill="{CREAM}"/>'
    s += f'<text x="80" y="110" font-size="56" font-weight="900" fill="{INK}" {FONT}>Memory is just edges</text>'
    s += f'<text x="80" y="160" font-size="26" font-weight="700" fill="#5B5B55" {FONT}>A 3/3 quiz deletes the old edge and MERGEs one new one. The next traversal sees it instantly.</text>'

    def pane(x, title, rel, rel_fill, score, status, root_text):
        p = f'<rect x="{x + 8}" y="228" width="560" height="440" rx="28" fill="{INK}"/>'
        p += f'<rect x="{x}" y="220" width="560" height="440" rx="28" fill="#FFFFFF" stroke="{INK}" stroke-width="4"/>'
        p += f'<text x="{x + 36}" y="285" font-size="32" font-weight="900" fill="{INK}" {FONT}>{title}</text>'
        p += f'<rect x="{x + 36}" y="320" width="180" height="84" rx="42" fill="#C9BFF7" stroke="{INK}" stroke-width="3"/>'
        p += f'<text x="{x + 126}" y="372" font-size="28" font-weight="900" text-anchor="middle" fill="{INK}" {FONT}>Tobi</text>'
        p += f'<rect x="{x + 300}" y="320" width="230" height="84" rx="42" fill="{AMBER}" stroke="{INK}" stroke-width="3"/>'
        p += f'<text x="{x + 415}" y="372" font-size="24" font-weight="900" text-anchor="middle" fill="{INK}" {FONT}>De Morgan</text>'
        p += f'<line x1="{x + 218}" y1="362" x2="{x + 296}" y2="362" stroke="{INK}" stroke-width="5" marker-end="url(#arr2)"/>'
        p += f'<rect x="{x + 110}" y="430" width="340" height="50" rx="25" fill="{rel_fill}" stroke="{INK}" stroke-width="3"/>'
        p += f'<text x="{x + 280}" y="464" font-size="22" font-weight="900" text-anchor="middle" fill="#FFFFFF" {FONT}>{rel} {score}</text>'
        p += f'<text x="{x + 36}" y="545" font-size="26" font-weight="800" fill="{INK}" {FONT}>Status: {status}</text>'
        p += f'<text x="{x + 36}" y="600" font-size="26" font-weight="800" fill="{INK}" {FONT}>{root_text}</text>'
        return p

    s += f'<defs><marker id="arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="{INK}"/></marker></defs>'
    s += pane(80, "Before the quiz", "STRUGGLED_WITH", RED, "35%", "Weak", "Root cause: De Morgan")
    s += pane(760, "After a 3/3 quiz", "MASTERED", GREEN, "74%", "Strong", "Next root: SR Latch (42%)")
    s += f'<text x="700" y="455" font-size="60" font-weight="900" text-anchor="middle" fill="{INK}" {FONT}>→</text>'
    return W, H, s


def main():
    out = HERE / "img"
    out.mkdir(exist_ok=True)
    jobs = {"2-chain": chain_svg(), "3-graph-model": model_svg(), "4-memory": memory_svg()}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, (w, h, body) in jobs.items():
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'
            (out / f"{name}.svg").write_text(svg, encoding="utf-8")
            page = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            page.set_content(f'<html><body style="margin:0">{svg}</body></html>')
            page.screenshot(path=str(out / f"{name}.png"))
            page.close()
        b.close()
    shutil.copy(ROOT / "app" / "static" / "icons" / "og.png", out / "1-cover.png")
    shutil.copy(ROOT / "screenshots" / "05_root_map_1280_dark.png", out / "5-root-map.png")
    shutil.copy(ROOT / "screenshots" / "06_plan_390_light.png", out / "6-plan-notes.png")
    print("images in", out)


if __name__ == "__main__":
    main()
