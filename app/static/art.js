/* RootCause visuals: the isometric "knowledge layers" illustration and the interactive root-system map. */
(() => {
  "use strict";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let uid = 0;

  // ------------------------------------------------------------ isometric hero
  // Three stacked slabs (what you're stuck on, what it builds on, the root),
  // a sprout on top and a root line pinned through all three.
  function slab(cx, y, top, left, right) {
    const w = 110, d = 44, t = 28;
    const hex = `${cx - w},${y} ${cx},${y - d} ${cx + w},${y} ${cx + w},${y + t} ${cx},${y + d + t} ${cx - w},${y + t}`;
    return `<polygon points="${hex}" transform="translate(7 7)" style="fill:var(--shadow-color)"/>
      <polygon points="${cx - w},${y} ${cx},${y + d} ${cx},${y + d + t} ${cx - w},${y + t}" fill="${left}"/>
      <polygon points="${cx},${y + d} ${cx + w},${y} ${cx + w},${y + t} ${cx},${y + d + t}" fill="${right}"/>
      <polygon points="${cx - w},${y} ${cx},${y - d} ${cx + w},${y} ${cx},${y + d}" fill="${top}"/>`;
  }
  function isoDot(cx, cy, fill, r = 17) {
    return `<ellipse cx="${cx + 2}" cy="${cy + 3}" rx="${r}" ry="${r * 0.56}" style="fill:var(--shadow-color)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.56}" fill="${fill}"/>
      <ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.18}" rx="${r * 0.32}" ry="${r * 0.14}" fill="#fff" fill-opacity=".75" stroke="none"/>`;
  }
  function heroArt(label = "") {
    const id = "h" + (++uid);
    return `<svg class="iso" viewBox="0 6 320 372" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>
      <defs>
        <radialGradient id="${id}a" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF6CF"/><stop offset="1" stop-color="#F5B700"/></radialGradient>
        <radialGradient id="${id}g" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#C9F5DC"/><stop offset="1" stop-color="#12A15E"/></radialGradient>
      </defs>
      <g stroke="#1A1A1A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <ellipse cx="160" cy="292" rx="70" ry="38" fill="#F5B700" fill-opacity=".22" stroke="none" class="iso-glow"/>
        ${slab(160, 292, "#F5B700", "#E0A100", "#B98400")}
        <path d="M78 300 l14 10 -6 9 12 8" fill="none"/>
        <path d="M232 312 l-10 8 8 7" fill="none"/>
        ${slab(160, 196, "#E3F1EA", "#A8DABF", "#7CC39E")}
        ${slab(160, 100, "#FFFFFF", "#EDE8DC", "#D9D2C2")}
        <path d="M160 100 V292" stroke="#1A1A1A" stroke-width="9"/>
        <path d="M160 100 V292" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="2 9"/>
        ${isoDot(160, 196, "#E5484D")}
        <ellipse cx="160" cy="292" rx="36" ry="20" fill="none" stroke="#F5B700" stroke-width="4" class="iso-ring"/>
        ${isoDot(160, 292, `url(#${id}a)`, 22)}
        <path d="M160 100 C 160 82, 158 66, 160 44" fill="none" stroke-width="5"/>
        <path d="M159 70 C 132 68, 116 50, 118 34 C 140 34, 157 50, 159 70 Z" fill="#4CC38A"/>
        <path d="M160 58 C 186 56, 202 38, 200 24 C 178 26, 161 42, 160 58 Z" fill="#12A15E"/>
        ${isoDot(160, 100, "#FF8A80", 15)}
        <circle cx="272" cy="64" r="17" fill="url(#${id}a)"/>
        <ellipse cx="266" cy="57" rx="5" ry="3" fill="#fff" fill-opacity=".8" stroke="none"/>
        <circle cx="44" cy="214" r="12" fill="url(#${id}g)"/>
        <ellipse cx="40" cy="209" rx="4" ry="2.4" fill="#fff" fill-opacity=".8" stroke="none"/>
        <path d="M52 92 l6 -14 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 Z" fill="#FFFFFF" stroke-width="2.5"/>
      </g>
    </svg>`;
  }

  // ------------------------------------------------------------ root-system map
  const SPH = {
    Weak: ["#FFC9C2", "#E5484D"], Okay: ["#FFE3A6", "#F59E0B"], Strong: ["#B9F2D2", "#12A15E"],
    "Not tried": ["#FFFFFF", "#BDB7AA"], root: ["#FFF1B8", "#F5B700"],
  };
  const GLYPH = { Weak: "warning", Okay: "half", Strong: "check", "Not tried": "dash" };

  function mapHTML(d) {
    return `<div class="gmap" id="gmap">
      <div class="gmap-stage">
        <svg class="gmap-svg" tabindex="-1" role="group" aria-label="Root system of ${esc(d.stuck.name)}: ${d.graph.nodes.length} topics. Drag to move, use the buttons to zoom, choose a topic for details."></svg>
        <div class="gmap-tools" role="toolbar" aria-label="Map controls">
          <button type="button" class="gmap-btn" data-gz="in" aria-label="Zoom in">+</button>
          <button type="button" class="gmap-btn" data-gz="out" aria-label="Zoom out">&minus;</button>
          <button type="button" class="gmap-btn wide" data-gz="fit" aria-label="Toggle between the chain and the whole root system">All</button>
        </div>
      </div>
      <ul class="gmap-legend" aria-hidden="true">
          <li><i style="--a:${SPH.Weak[0]};--b:${SPH.Weak[1]}"></i>Weak</li>
          <li><i style="--a:${SPH.Okay[0]};--b:${SPH.Okay[1]}"></i>Okay</li>
          <li><i style="--a:${SPH.Strong[0]};--b:${SPH.Strong[1]}"></i>Strong</li>
          <li><i style="--a:${SPH["Not tried"][0]};--b:${SPH["Not tried"][1]}"></i>Not tried</li>
      </ul>
      <div class="gmap-detail" aria-live="polite"></div>
    </div>`;
  }

  function initMap(d, { onDiagnose, onQuiz, badge, pct }) {
    const wrap = document.getElementById("gmap");
    if (!wrap) return;
    const svg = wrap.querySelector(".gmap-svg");
    const detail = wrap.querySelector(".gmap-detail");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- layout: one row per hop distance from the stuck topic, roots fan out below
    const nodes = d.graph.nodes.map((n) => ({ ...n }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const out = {}, inc = {};
    nodes.forEach((n) => { out[n.id] = []; inc[n.id] = []; });
    const edges = d.graph.edges.filter((e) => byId[e.source] && byId[e.target]);
    edges.forEach((e) => { out[e.source].push(e.target); inc[e.target].push(e.source); });
    const rows = [];
    nodes.forEach((n) => (rows[n.hops] = rows[n.hops] || []).push(n));
    const GX = 124, GY = 94, PAD = 56;
    const widest = Math.max(...rows.map((r) => (r ? r.length : 0)));
    const VW = Math.max(380, (widest - 1) * GX + PAD * 2);
    rows.forEach((r, i) => {
      if (!r) return;
      if (i > 0) {
        r.forEach((n) => {
          const xs = out[n.id].map((t) => byId[t].x).filter((x) => x !== undefined);
          n.bx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : VW / 2;
        });
        r.sort((a, b) => a.bx - b.bx);
      }
      const span = (r.length - 1) * GX;
      r.forEach((n, j) => { n.x = VW / 2 - span / 2 + j * GX; n.y = PAD + i * GY + (r.length > 2 && j % 2 ? 18 : 0); });
    });
    const VH = PAD * 2 + (rows.length - 1) * GY + 18;

    const chainIds = new Set(d.chain.map((c) => c.id));
    const chainPairs = new Set(d.chain.slice(0, -1).map((c, i) => d.chain[i + 1].id + ">" + c.id));
    const radius = (n) => (n.id === d.root.id ? 24 : n.id === d.stuck.id ? 21 : 15);
    const curve = (a, b) => `M${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`;
    const short = (s) => (s.length > 16 ? s.slice(0, 15) + "…" : s);

    const grads = Object.entries(SPH).map(([k, [a, b]]) =>
      `<radialGradient id="gs-${k.replace(/\s/g, "")}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`).join("");

    const edgeSvg = edges.map((e) => {
      const on = chainPairs.has(e.source + ">" + e.target);
      return `<path class="ge${on ? " chain" : ""}" data-s="${esc(e.source)}" data-t="${esc(e.target)}" d="${curve(byId[e.source], byId[e.target])}"/>`;
    }).join("");
    const flowSvg = edges.filter((e) => chainPairs.has(e.source + ">" + e.target))
      .map((e) => `<path class="gflow" d="${curve(byId[e.source], byId[e.target])}"/>`).join("");

    const nodeSvg = nodes.map((n) => {
      const r = radius(n), isRoot = n.id === d.root.id, isStuck = n.id === d.stuck.id;
      const grad = isRoot ? "root" : n.status.replace(/\s/g, "");
      const cls = ["gn", isRoot ? "root" : "", isStuck ? "stuck" : "", chainIds.has(n.id) ? "on-chain" : ""].join(" ");
      const label = `${n.name}. ${n.status}${n.score !== null && n.score !== undefined ? ", " + n.score + "%" : ""}.${isRoot ? " Root cause." : ""}${isStuck ? " Where you're stuck." : ""}`;
      return `<g class="${cls}" data-id="${esc(n.id)}" transform="translate(${n.x} ${n.y})" tabindex="0" role="button" aria-label="${esc(label)}">
        ${isRoot ? `<circle class="gn-halo" r="${r + 12}"/>` : ""}
        <circle class="gn-shadow" r="${r}" cx="3" cy="4"/>
        <circle class="gn-ball" r="${r}" fill="url(#gs-${grad})"/>
        <ellipse class="gn-shine" cx="${-r * 0.36}" cy="${-r * 0.42}" rx="${r * 0.34}" ry="${r * 0.2}"/>
        <use href="#i-${isRoot ? "root" : GLYPH[n.status] || "dash"}" x="${-r * 0.55}" y="${-r * 0.55}" width="${r * 1.1}" height="${r * 1.1}" class="gn-glyph"/>
        <text class="gn-label" y="${r + 22}">${esc(short(n.name))}</text>
      </g>`;
    }).join("");

    svg.innerHTML = `<defs>${grads}</defs><g class="gvp">${edgeSvg}${reduce ? "" : flowSvg}${nodeSvg}</g>`;
    const vp = svg.querySelector(".gvp");

    // ---- view transform: user units == screen pixels, so 14/scale keeps labels 14px on screen
    let CW = 0, CH = 0;
    const view = { s: 1, tx: 0, ty: 0 };
    function apply() {
      view.s = Math.min(2.5, Math.max(0.35, view.s));
      vp.setAttribute("transform", `translate(${view.tx} ${view.ty}) scale(${view.s})`);
      svg.style.setProperty("--lab", 14 / view.s + "px");
      svg.classList.toggle("far", view.s < 0.85);
    }
    // whole=false frames the diagnosis chain at a readable size; whole=true shows the full root system.
    function fit(whole = false) {
      CW = svg.clientWidth || 340;
      CH = Math.round(Math.min(560, Math.max(430, CW * 1.1)));
      svg.setAttribute("viewBox", `0 0 ${CW} ${CH}`);
      svg.style.height = CH + "px";
      let x0 = 0, y0 = 0, x1 = VW, y1 = VH;
      if (!whole) {
        const cs = nodes.filter((n) => chainIds.has(n.id));
        x0 = Math.min(...cs.map((n) => n.x)) - 90; x1 = Math.max(...cs.map((n) => n.x)) + 90;
        y0 = Math.min(...cs.map((n) => n.y)) - 50; y1 = Math.max(...cs.map((n) => n.y)) + 70;
      }
      view.s = Math.min(whole ? 1.15 : 1.2, CW / (x1 - x0), CH / (y1 - y0));
      view.tx = CW / 2 - ((x0 + x1) / 2) * view.s;
      view.ty = CH / 2 - ((y0 + y1) / 2) * view.s;
      apply();
    }
    function zoomAt(f, cx = CW / 2, cy = CH / 2) {
      const ns = Math.min(2.5, Math.max(0.35, view.s * f));
      const k = ns / view.s;
      view.tx = cx - (cx - view.tx) * k;
      view.ty = cy - (cy - view.ty) * k;
      view.s = ns;
      apply();
    }
    let fitted = false;
    fit();

    // ---- highlight a node's path up to the stuck topic
    function downstream(id) {
      const seen = new Set([id]), stack = [id];
      while (stack.length) for (const t of out[stack.pop()]) if (!seen.has(t)) { seen.add(t); stack.push(t); }
      return seen;
    }
    function upstream(id) {
      const seen = new Set([id]), stack = [id];
      while (stack.length) for (const s of inc[stack.pop()]) if (!seen.has(s)) { seen.add(s); stack.push(s); }
      return seen;
    }
    function light(id) {
      if (!id) { svg.classList.remove("focusing"); svg.querySelectorAll(".lit").forEach((x) => x.classList.remove("lit")); return; }
      const set = id === d.stuck.id ? upstream(id) : downstream(id);
      svg.classList.add("focusing");
      svg.querySelectorAll(".gn").forEach((g) => g.classList.toggle("lit", set.has(g.dataset.id)));
      svg.querySelectorAll(".ge").forEach((p) => p.classList.toggle("lit", set.has(p.dataset.s) && set.has(p.dataset.t)));
    }
    let selected = null;
    function select(id) {
      selected = id;
      svg.querySelectorAll(".gn").forEach((g) => g.classList.toggle("sel", g.dataset.id === id));
      light(id);
      const n = byId[id];
      if (!n) { detail.innerHTML = ""; return; }
      const isRoot = id === d.root.id, isStuck = id === d.stuck.id;
      const where = isStuck ? "Where you're stuck" : `${n.hops} ${n.hops === 1 ? "step" : "steps"} below ${esc(d.stuck.name)}`;
      detail.innerHTML = `<div class="gd card">
        <p class="gd-where">${isRoot ? `<span class="rc-sticker gd-sticker">Root cause</span>` : ""}<span class="muted">${where}</span></p>
        <p class="gd-name">${esc(n.name)}</p>
        <p class="node-meta">${badge(n.status)}<span class="num">${esc(pct(n.score))}</span><span class="muted">Unlocks ${n.unlocks} later ${n.unlocks === 1 ? "topic" : "topics"}</span></p>
        <p>${esc(n.summary || "")}</p>
        <div class="btn-row">
          ${isRoot ? `<button class="btn btn-primary" type="button" data-gaction="quiz">Test me on ${esc(n.name)}</button>` : ""}
          ${!isStuck ? `<button class="btn btn-secondary" type="button" data-gaction="diag" data-id="${esc(n.id)}" data-name="${esc(n.name)}">Diagnose ${esc(n.name)}</button>` : ""}
          <button class="btn btn-ghost" type="button" data-gaction="close">Close</button>
        </div>
      </div>`;
    }

    // ---- pointer: drag to pan, pinch / ctrl+wheel / double-tap to zoom, tap a node to select
    const pts = new Map();
    let moved = 0, pinch0 = 0, downNode = null;
    svg.addEventListener("pointerdown", (e) => {
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      downNode = e.target.closest(".gn");
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
      svg.classList.add("grabbing");
    });
    svg.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId);
      if (!p) {
        const g = e.target.closest(".gn");
        if (!selected) light(g ? g.dataset.id : null);
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = svg.getBoundingClientRect();
        if (pinch0) zoomAt(dist / pinch0, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        pinch0 = dist;
        moved += 10;
        return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      view.tx += dx; view.ty += dy;
      apply();
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = 0;
      if (!pts.size) svg.classList.remove("grabbing");
      if (e.type === "pointerup" && moved < 6) {
        if (downNode) select(downNode.dataset.id);
        else if (selected) select(null);
      }
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("pointerleave", () => { if (!selected && !pts.size) light(null); });
    svg.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
    svg.addEventListener("dblclick", (e) => {
      const rect = svg.getBoundingClientRect();
      zoomAt(1.5, e.clientX - rect.left, e.clientY - rect.top);
    });
    svg.addEventListener("focusin", (e) => { const g = e.target.closest(".gn"); if (g && !selected) light(g.dataset.id); });
    svg.addEventListener("keydown", (e) => {
      const g = e.target.closest(".gn");
      if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(g.dataset.id); }
      if (e.key === "Escape") { select(null); }
    });
    wrap.querySelector(".gmap-tools").addEventListener("click", (e) => {
      const b = e.target.closest("[data-gz]");
      if (!b) return;
      if (b.dataset.gz === "in") zoomAt(1.3);
      if (b.dataset.gz === "out") zoomAt(1 / 1.3);
      if (b.dataset.gz === "fit") { fitted = !fitted; fit(fitted); b.textContent = fitted ? "Chain" : "All"; }
    });
    detail.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gaction]");
      if (!b) return;
      if (b.dataset.gaction === "close") { select(null); return; }
      if (b.dataset.gaction === "quiz") onQuiz();
      if (b.dataset.gaction === "diag") onDiagnose(b.dataset.id, b.dataset.name);
    });
    let rt;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.contains(svg)) fit(fitted); else removeEventListener("resize", onResize); }, 150); };
    addEventListener("resize", onResize);
    select(d.root.id);
  }

  window.RootArt = { heroArt, mapHTML, initMap };
})();
