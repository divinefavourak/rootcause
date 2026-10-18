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

  // ------------------------------------------------------------ root-system map (node-editor style)
  // Cards are real <button>s placed in a pannable, zoomable "world"; connectors are an SVG layer underneath.
  const SPH = {
    Weak: ["#FFC9C2", "#E5484D"], Okay: ["#FFE3A6", "#F59E0B"], Strong: ["#B9F2D2", "#12A15E"],
    "Not tried": ["#FFFFFF", "#BDB7AA"],
  };
  const STATUS_GLYPH = { Weak: "warning", Okay: "half", Strong: "check", "Not tried": "dash" };
  const CARD_W = 208, CARD_H = 104, GX = 240, GY = 142, PAD = 40;

  function mapHTML(d) {
    return `<div class="gmap" id="gmap">
      <div class="gmap-stage" role="group" aria-label="Root map of ${esc(d.stuck.name)}: ${d.graph.nodes.length} topics. Drag to move around, use the zoom buttons, choose a card for details.">
        <div class="gworld">
          <svg class="gedges" aria-hidden="true"></svg>
          <div class="gcards"></div>
        </div>
        <div class="gtools" role="toolbar" aria-label="Map controls">
          <button type="button" data-gz="in" aria-label="Zoom in"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
          <button type="button" data-gz="out" aria-label="Zoom out"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
          <button type="button" data-gz="fit" aria-label="Show the whole root system" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <p class="ghint" aria-hidden="true">Drag to explore</p>
      </div>
      <div class="gmap-detail" aria-live="polite"></div>
    </div>`;
  }

  function initMap(d, { onDiagnose, onQuiz, pct }) {
    const wrap = document.getElementById("gmap");
    if (!wrap) return;
    const stage = wrap.querySelector(".gmap-stage");
    const world = wrap.querySelector(".gworld");
    const edgeSvg = wrap.querySelector(".gedges");
    const cardsBox = wrap.querySelector(".gcards");
    const detail = wrap.querySelector(".gmap-detail");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- layout: one row per hop distance from the stuck topic; prerequisites fan out below
    const nodes = d.graph.nodes.map((n) => ({ ...n }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const out = {}, inc = {};
    nodes.forEach((n) => { out[n.id] = []; inc[n.id] = []; });
    const edges = d.graph.edges.filter((e) => byId[e.source] && byId[e.target]);
    edges.forEach((e) => { out[e.source].push(e.target); inc[e.target].push(e.source); });
    const rows = [];
    nodes.forEach((n) => (rows[n.hops] = rows[n.hops] || []).push(n));
    const widest = Math.max(...rows.map((r) => (r ? r.length : 0)));
    const VW = Math.max(CARD_W + PAD * 2, (widest - 1) * GX + CARD_W + PAD * 2);
    rows.forEach((r, i) => {
      if (!r) return;
      if (i > 0) {
        r.forEach((n) => {
          const xs = out[n.id].map((t) => byId[t].cx).filter((x) => x !== undefined);
          n.bx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : VW / 2;
        });
        r.sort((a, b) => a.bx - b.bx);
      }
      const span = (r.length - 1) * GX;
      r.forEach((n, j) => {
        n.cx = VW / 2 - span / 2 + j * GX;
        n.x = n.cx - CARD_W / 2;
        n.y = PAD + 18 + i * GY;
      });
    });
    const VH = PAD * 2 + 18 + (rows.length - 1) * GY + CARD_H;
    world.style.width = VW + "px";
    world.style.height = VH + "px";
    edgeSvg.setAttribute("width", VW);
    edgeSvg.setAttribute("height", VH);
    edgeSvg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);

    const chainIds = new Set(d.chain.map((c) => c.id));
    const chainPairs = new Set(d.chain.slice(0, -1).map((c, i) => d.chain[i + 1].id + ">" + c.id));

    // ---- connectors: from the bottom port of the later topic down to the top port of its prerequisite,
    // with right-angle turns and rounded corners.
    function elbow(from, to) {
      const x1 = from.cx, y1 = from.y + CARD_H, x2 = to.cx, y2 = to.y;
      const midY = y1 + (y2 - y1) / 2;
      if (Math.abs(x1 - x2) < 1) return `M${x1} ${y1} V${y2}`;
      const r = Math.min(16, Math.abs(x2 - x1) / 2, (y2 - y1) / 4);
      const dir = x2 > x1 ? 1 : -1;
      return `M${x1} ${y1} V${midY - r} Q${x1} ${midY} ${x1 + dir * r} ${midY} H${x2 - dir * r} Q${x2} ${midY} ${x2} ${midY + r} V${y2}`;
    }
    edgeSvg.innerHTML = edges.map((e) => {
      const on = chainPairs.has(e.source + ">" + e.target);
      const lower = byId[e.source], upper = byId[e.target];
      const path = elbow(upper, lower);
      return `<g class="gedge${on ? " chain" : ""}" data-s="${esc(e.source)}" data-t="${esc(e.target)}">
        <path class="gline" d="${path}"/>
        ${on && !reduce ? `<path class="gflow" d="${path}"/>` : ""}
        <circle class="gport" cx="${upper.cx}" cy="${upper.y + CARD_H}" r="4.5"/>
        <circle class="gport" cx="${lower.cx}" cy="${lower.y}" r="4.5"/>
      </g>`;
    }).join("");

    // ---- cards
    cardsBox.innerHTML = nodes.map((n) => {
      const isRoot = n.id === d.root.id, isStuck = n.id === d.stuck.id;
      const kind = isRoot ? "root" : isStuck ? "stuck" : chainIds.has(n.id) ? "chain" : "off";
      const [a, b] = SPH[n.status] || SPH["Not tried"];
      const tag = isRoot ? `<span class="gtag gtag-root"><svg aria-hidden="true"><use href="#i-warning"/></svg>Root cause</span>`
        : isStuck ? `<span class="gtag gtag-stuck">You're stuck here</span>` : "";
      const label = `${n.name}. ${n.status}${n.score !== null && n.score !== undefined ? ", " + n.score + "%" : ""}.${isRoot ? " Root cause." : ""}${isStuck ? " Where you're stuck." : ""}`;
      return `<button type="button" class="gcard ${kind}" data-id="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px" aria-label="${esc(label)}">
        ${tag}
        <span class="gcard-top">
          <span class="gsph" style="--a:${a};--b:${b}"><svg aria-hidden="true"><use href="#i-${STATUS_GLYPH[n.status] || "dash"}"/></svg></span>
          <span class="gstatus">${esc(n.status)}</span>
          ${n.score === null || n.score === undefined ? "" : `<span class="gscore">${n.score}%</span>`}
        </span>
        <span class="gname">${esc(n.name)}</span>
      </button>`;
    }).join("");

    // ---- view: translate + scale on the world; text never drops below ~14px in the default view
    const view = { s: 1, tx: 0, ty: 0 };
    let CW = 0, CH = 0, showAll = false;
    function apply() {
      view.s = Math.min(1.6, Math.max(0.3, view.s));
      world.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
      stage.classList.toggle("far", view.s < 0.62);
    }
    function frame(all) {
      CW = stage.clientWidth || 340;
      CH = stage.clientHeight || 460;
      let x0 = 0, y0 = 0, x1 = VW, y1 = VH;
      if (!all) {
        const cs = nodes.filter((n) => chainIds.has(n.id));
        x0 = Math.min(...cs.map((n) => n.x)) - 24; x1 = Math.max(...cs.map((n) => n.x + CARD_W)) + 24;
        y0 = Math.min(...cs.map((n) => n.y)) - 40; y1 = Math.max(...cs.map((n) => n.y + CARD_H)) + 24;
      }
      const fitS = Math.min(CW / (x1 - x0), CH / (y1 - y0));
      // Narrow phones may go down to 0.8 so the chain's width fits; text stays about 14px.
      const floor = CW < 480 ? Math.max(0.8, Math.min(0.88, CW / (x1 - x0))) : 0.88;
      view.s = all ? Math.min(1, fitS) : Math.min(1, Math.max(floor, fitS));
      // Default view: if the whole chain doesn't fit at a readable size, start at the stuck topic and let them pan down.
      const cy = !all && fitS < floor ? y0 + CH / view.s / 2 : (y0 + y1) / 2;
      view.tx = CW / 2 - ((x0 + x1) / 2) * view.s;
      view.ty = CH / 2 - cy * view.s;
      apply();
    }
    function zoomAt(f, cx = CW / 2, cy = CH / 2) {
      const ns = Math.min(1.6, Math.max(0.3, view.s * f)), k = ns / view.s;
      view.tx = cx - (cx - view.tx) * k;
      view.ty = cy - (cy - view.ty) * k;
      view.s = ns;
      apply();
    }
    frame(false);

    // ---- path highlighting
    const walk = (id, next) => {
      const seen = new Set([id]), stack = [id];
      while (stack.length) for (const t of next[stack.pop()]) if (!seen.has(t)) { seen.add(t); stack.push(t); }
      return seen;
    };
    function light(id) {
      stage.classList.toggle("focusing", !!id);
      const set = id ? (id === d.stuck.id ? walk(id, inc) : walk(id, out)) : new Set();
      cardsBox.querySelectorAll(".gcard").forEach((c) => c.classList.toggle("lit", set.has(c.dataset.id)));
      edgeSvg.querySelectorAll(".gedge").forEach((g) => g.classList.toggle("lit", set.has(g.dataset.s) && set.has(g.dataset.t)));
    }
    let selected = null;
    function select(id) {
      selected = id;
      cardsBox.querySelectorAll(".gcard").forEach((c) => {
        c.classList.toggle("sel", c.dataset.id === id);
        c.setAttribute("aria-pressed", String(c.dataset.id === id));
      });
      light(id);
      const n = byId[id];
      if (!n) { detail.innerHTML = ""; return; }
      const isRoot = id === d.root.id, isStuck = id === d.stuck.id;
      const where = isStuck ? "Where you're stuck" : `${n.hops} ${n.hops === 1 ? "step" : "steps"} below ${esc(d.stuck.name)}`;
      const [a, b] = SPH[n.status] || SPH["Not tried"];
      detail.innerHTML = `<div class="gdetail ${isRoot ? "root" : n.status === "Weak" ? "weak" : "calm"}">
        <div class="gdetail-head">
          <span class="gsph big" style="--a:${a};--b:${b}"><svg aria-hidden="true"><use href="#i-${STATUS_GLYPH[n.status] || "dash"}"/></svg></span>
          <div><p class="gdetail-where">${isRoot ? "Root cause, " : ""}${where}</p><p class="gdetail-name">${esc(n.name)}</p></div>
        </div>
        <p class="gdetail-facts"><b>${esc(n.status)}</b>${n.score === null || n.score === undefined ? "" : `<span>${n.score}%</span>`}<span>Unlocks ${n.unlocks} later ${n.unlocks === 1 ? "topic" : "topics"}</span></p>
        <p>${esc(n.summary || "")}</p>
        <div class="gdetail-actions">
          ${isRoot ? `<button class="gpill" type="button" data-gaction="quiz">Test me on this</button>` : ""}
          ${!isStuck ? `<button class="gpill${isRoot ? " ghost" : ""}" type="button" data-gaction="diag" data-id="${esc(n.id)}" data-name="${esc(n.name)}">Diagnose this topic</button>` : ""}
          <button class="gpill ghost" type="button" data-gaction="close">Close</button>
        </div>
      </div>`;
    }

    // ---- pointer: drag anywhere to pan (cards included), pinch or ctrl+wheel to zoom, tap a card to select
    const pts = new Map();
    let moved = 0, pinch0 = 0;
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".gtools")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch0 = Math.hypot(p.x - q.x, p.y - q.y); }
    });
    stage.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId);
      if (!p) {
        if (!selected) { const c = e.target.closest(".gcard"); light(c ? c.dataset.id : null); }
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y), rect = stage.getBoundingClientRect();
        if (pinch0) zoomAt(dist / pinch0, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        pinch0 = dist; moved += 10;
        return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 5) {
        if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
        stage.classList.add("grabbing");
        view.tx += dx; view.ty += dy;
        apply();
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = 0;
      if (!pts.size) stage.classList.remove("grabbing");
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener("pointerleave", () => { if (!selected && !pts.size) light(null); });
    stage.addEventListener("click", (e) => {
      if (e.target.closest(".gtools")) return;
      if (moved > 5) { moved = 0; return; } // that was a drag, not a tap
      const c = e.target.closest(".gcard");
      if (c) select(c.dataset.id === selected ? null : c.dataset.id);
      else if (selected) select(null);
    });
    stage.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
    stage.addEventListener("focusin", (e) => {
      const c = e.target.closest(".gcard");
      if (!c) return;
      if (!selected) light(c.dataset.id);
      // keep the focused card on screen when tabbing through
      const n = byId[c.dataset.id];
      const sx = n.x * view.s + view.tx, sy = n.y * view.s + view.ty;
      if (sx < 0 || sy < 0 || sx + CARD_W * view.s > CW || sy + CARD_H * view.s > CH) {
        view.tx = CW / 2 - n.cx * view.s; view.ty = CH / 2 - (n.y + CARD_H / 2) * view.s; apply();
      }
    });
    stage.addEventListener("keydown", (e) => { moved = 0; if (e.key === "Escape") select(null); });
    wrap.querySelector(".gtools").addEventListener("click", (e) => {
      const b = e.target.closest("[data-gz]");
      if (!b) return;
      if (b.dataset.gz === "in") zoomAt(1.2);
      if (b.dataset.gz === "out") zoomAt(1 / 1.2);
      if (b.dataset.gz === "fit") {
        showAll = !showAll; frame(showAll);
        b.setAttribute("aria-pressed", String(showAll));
        b.setAttribute("aria-label", showAll ? "Back to the diagnosed chain" : "Show the whole root system");
      }
    });
    detail.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gaction]");
      if (!b) return;
      if (b.dataset.gaction === "close") { select(null); return; }
      if (b.dataset.gaction === "quiz") onQuiz();
      if (b.dataset.gaction === "diag") onDiagnose(b.dataset.id, b.dataset.name);
    });
    let rt;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (document.body.contains(stage)) frame(showAll); else removeEventListener("resize", onResize); }, 150);
    };
    addEventListener("resize", onResize);
    // Wide screens open with the root cause's details beside the map; phones keep the canvas clear.
    if (matchMedia("(min-width: 900px)").matches) select(d.root.id);
    else light(d.root.id);
  }

  window.RootArt = { heroArt, mapHTML, initMap };
})();
