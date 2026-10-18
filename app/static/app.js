/* RootCause frontend. Vanilla JS, no dependencies. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const STATUS_ICON = { Weak: "warning", Okay: "half", Strong: "check", "Not tried": "dash", Review: "dash" };
  const badge = (s) => `<span class="badge" data-s="${esc(s)}">${icon(STATUS_ICON[s] || "dash")}${esc(s)}</span>`;
  const pct = (n) => (n === null || n === undefined ? "Not tried" : `${n}%`);
  const UNIT_ORDER = ["Numbers and codes", "Gates and Boolean algebra", "Combinational circuits", "Sequential circuits"];
  const QUICK = [["flip_flops", "Flip-Flops"], ["kmaps", "Karnaugh Maps"], ["multiplexer", "Multiplexers"], ["twos_complement", "Two's Complement"], ["counters_sync", "Synchronous Counters"]];

  const store = {
    get(k, d = null) { try { const v = localStorage.getItem("rc:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("rc:" + k, JSON.stringify(v)); } catch { /* storage blocked: fine */ } },
  };

  const state = { students: [], student: null, diagnosis: null, selected: null, quiz: null, qIndex: 0, answers: [], result: null, overview: null, filter: "All", lastChange: null };

  // ------------------------------------------------------------------ api
  async function api(path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Something went wrong on our side. Try again.");
      return data;
    } catch (e) {
      if (!navigator.onLine) throw new Error("You're offline. Connect and try again.");
      if (e.name === "AbortError") throw new Error("That took too long. Try again.");
      throw e;
    } finally { clearTimeout(timer); }
  }

  // ------------------------------------------------------------------ toast
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ------------------------------------------------------------------ theme
  function effectiveTheme() {
    const set = document.documentElement.dataset.theme;
    return set || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function paintThemeButton() {
    const dark = effectiveTheme() === "dark";
    const b = $("#themeToggle");
    b.innerHTML = icon(dark ? "sun" : "moon");
    b.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  function initTheme() {
    const saved = store.get("theme");
    if (saved) document.documentElement.dataset.theme = saved;
    paintThemeButton();
    $("#themeToggle").addEventListener("click", () => {
      const next = effectiveTheme() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      store.set("theme", next);
      paintThemeButton();
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintThemeButton);
  }

  // ------------------------------------------------------------------ speech output
  const canSpeak = "speechSynthesis" in window;
  let speaking = null; // the .speak wrapper currently talking
  function speakerHTML(key, label = "Listen") {
    if (!canSpeak) return "";
    return `<span class="speak btn-row" data-say="${esc(key)}">
      <button class="btn btn-ghost say-btn" type="button">${icon("speaker")}<span>${esc(label)}</span></button>
      <button class="btn btn-ghost stop-btn" type="button" hidden aria-label="Stop reading">${icon("stop")}<span>Stop</span></button>
    </span>`;
  }
  function resetSpeaker(w) {
    if (!w) return;
    const b = $(".say-btn", w);
    if (b) b.innerHTML = `${icon("speaker")}<span>Listen</span>`;
    const s = $(".stop-btn", w); if (s) s.hidden = true;
  }
  function sayText(key) {
    const d = state.diagnosis;
    if (key === "diagnosis" && d) {
      return `You are stuck on ${d.stuck.name}. The root cause is ${d.root.name}, where your score is ${pct(d.root.score)}. ${d.explanation || ""}`;
    }
    if (key === "plan" && d) {
      return d.plan.map((day) => `Day ${day.day}. ` + day.items.map((i) => `${i.name}: ${i.task} About ${i.minutes} minutes.`).join(" ")).join(" ");
    }
    if (key === "question" && state.quiz) {
      const q = state.quiz.questions[state.qIndex];
      return `${q.prompt} ` + q.options.map((o, i) => `Option ${"ABCD"[i]}: ${o}.`).join(" ");
    }
    return "";
  }
  document.addEventListener("click", (e) => {
    const w = e.target.closest(".speak");
    if (!w || !canSpeak) return;
    const synth = window.speechSynthesis;
    if (e.target.closest(".stop-btn")) { synth.cancel(); resetSpeaker(speaking); speaking = null; return; }
    if (!e.target.closest(".say-btn")) return;
    const btn = $(".say-btn", w);
    if (speaking === w && synth.speaking) {
      if (synth.paused) { synth.resume(); btn.innerHTML = `${icon("pause")}<span>Pause</span>`; }
      else { synth.pause(); btn.innerHTML = `${icon("speaker")}<span>Resume</span>`; }
      return;
    }
    synth.cancel(); resetSpeaker(speaking);
    const u = new SpeechSynthesisUtterance(sayText(w.dataset.say));
    u.lang = "en-NG"; u.rate = 0.98;
    u.onend = u.onerror = () => { if (speaking === w) { resetSpeaker(w); speaking = null; } };
    speaking = w;
    btn.innerHTML = `${icon("pause")}<span>Pause</span>`;
    $(".stop-btn", w).hidden = false;
    synth.speak(u);
  });
  function stopSpeaking() { if (canSpeak) { window.speechSynthesis.cancel(); resetSpeaker(speaking); speaking = null; } }

  // ------------------------------------------------------------------ speech input
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  function listen({ onInterim, onFinal, onState }) {
    if (!Recognition) return null;
    let lang = "en-NG", gotResult = false, rec;
    const start = () => {
      rec = new Recognition();
      rec.lang = lang; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
      rec.onstart = () => onState("listening");
      rec.onresult = (ev) => {
        let interim = "", final = "";
        for (const r of ev.results) (r.isFinal ? (final += r[0].transcript) : (interim += r[0].transcript));
        if (final) { gotResult = true; onState("processing"); onFinal(final.trim()); }
        else onInterim(interim.trim());
      };
      rec.onerror = (ev) => {
        if ((ev.error === "language-not-supported" || ev.error === "bad-grammar") && lang !== "en-US") { lang = "en-US"; gotResult = false; start(); return; }
        gotResult = true;
        onState("error", ev.error);
      };
      rec.onend = () => { if (!gotResult) onState("idle"); };
      try { rec.start(); } catch { onState("error", "busy"); }
    };
    start();
    return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
  }
  const VOICE_ERRORS = {
    "not-allowed": "Mic access is blocked. No problem, just type it.",
    "service-not-allowed": "Mic access is blocked. No problem, just type it.",
    "no-speech": "I didn't catch anything. Tap the mic and try again.",
    "network": "Voice needs a connection. Typing still works.",
    "audio-capture": "No microphone found. Typing works fine.",
  };

  // ------------------------------------------------------------------ routing
  const VIEWS = ["home", "plan", "progress", "quiz"];
  function route() {
    const name = (location.hash.slice(1) || "home");
    const view = VIEWS.includes(name) ? name : "home";
    if (view !== "quiz") stopSpeaking();
    closeMap();
    VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== view; });
    $$(".bottomnav a").forEach((a) => {
      if (a.dataset.nav === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (view === "plan") renderPlanView();
    if (view === "progress") loadProgress();
    if (view === "quiz" && !state.quiz) { location.replace("#home"); return; }
    window.scrollTo(0, 0);
    if (route.ready) $("#view-" + view).querySelector("h1")?.setAttribute("tabindex", "-1");
    if (route.ready && view !== "home") $("#view-" + view).querySelector("h1")?.focus({ preventScroll: true });
    route.ready = true;
  }

  // ------------------------------------------------------------------ students
  const initials = (n) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  async function loadStudents() {
    try {
      state.students = await api("/api/students");
      store.set("students", state.students);
    } catch {
      state.students = store.get("students", []);
    }
    $("#studentList").innerHTML = state.students.length ? state.students.map((s) => `
      <li><button class="student-card" type="button" data-student="${esc(s.id)}">
        <span class="avatar" aria-hidden="true">${esc(initials(s.name))}</span>
        <span><b>${esc(s.name)}</b><span class="muted">${esc(s.blurb || "")}</span></span>
      </button></li>`).join("")
      : `<li>${errorHTML("Can't reach the study graph right now.", "retry-students")}</li>`;
  }
  function chooseStudent(id) {
    const s = state.students.find((x) => x.id === id);
    if (!s) return;
    state.student = s; store.set("student", s.id);
    state.diagnosis = store.get("diag:" + s.id);
    state.overview = null; state.lastChange = null;
    $("#studentName").textContent = s.name;
    $("#studentAvatar").textContent = initials(s.name);
    $("#studentSwitch").hidden = false;
    $("#picker").hidden = true; $("#homeMain").hidden = false;
    if (state.diagnosis) renderResults(state.diagnosis, { animate: false });
    else { $("#results").innerHTML = ""; $("#results").classList.remove("has-data"); $("#homeMain").classList.remove("has-results"); }
  }
  function showPicker() {
    location.hash = "#home";
    $("#picker").hidden = false; $("#homeMain").hidden = true;
    $(".student-card")?.focus();
  }

  // ------------------------------------------------------------------ ask flow
  function setSelected(c) {
    state.selected = c;
    $$("#suggest .chip, #quickChips .chip").forEach((ch) => ch.setAttribute("aria-pressed", String(!!c && ch.dataset.id === c.id)));
  }
  function suggestHTML(matches, title) {
    return `<p class="suggest-title">${esc(title)}</p>
      <div class="chips">${matches.map((m) => `<button class="chip" type="button" data-id="${esc(m.id)}" data-name="${esc(m.name)}" aria-pressed="false">${icon("check")}<span>${esc(m.name)}</span></button>`).join("")}</div>`;
  }
  async function resolveAndMaybeDiagnose(text, { fromVoice = false } = {}) {
    const sug = $("#suggest");
    try {
      const r = await api("/api/concepts/resolve?q=" + encodeURIComponent(text));
      if (!r.matches.length) {
        sug.innerHTML = `<p class="suggest-title">I couldn't match that to an IFT 211 topic.</p><p class="muted">Try a shorter name, like “k map” or “flip flops”.</p>`;
        return;
      }
      if (r.confident && !fromVoice) { sug.innerHTML = ""; return diagnose(r.best.id, r.best.name); }
      if (r.confident) {
        sug.innerHTML = suggestHTML([r.best], "Is this the topic?") + `<p class="muted">Tap Find the root to continue, or pick another below.</p>` +
          (r.matches.length > 1 ? `<div class="chips">${r.matches.slice(1).map((m) => `<button class="chip" type="button" data-id="${esc(m.id)}" data-name="${esc(m.name)}" aria-pressed="false">${icon("check")}<span>${esc(m.name)}</span></button>`).join("")}</div>` : "");
        setSelected(r.best);
        return;
      }
      sug.innerHTML = suggestHTML(r.matches, "Did you mean...?");
    } catch (e) { sug.innerHTML = `<p class="suggest-title">${esc(e.message)}</p>`; }
  }
  function initAsk() {
    $("#quickChips").innerHTML = QUICK.map(([id, name]) => `<button class="chip" type="button" data-id="${id}" data-name="${esc(name)}" aria-pressed="false">${icon("check")}<span>${esc(name)}</span></button>`).join("");
    $("#topic").addEventListener("input", () => { if (state.selected && $("#topic").value !== state.selected.name) setSelected(null); });
    $("#askForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = $("#topic").value.trim();
      if (state.selected && (!text || text === state.selected.name || $("#suggest").innerHTML)) return diagnose(state.selected.id, state.selected.name);
      if (!text) { $("#suggest").innerHTML = `<p class="suggest-title">Type or say a topic first.</p><p class="muted">Or tap one of the common ones below.</p>`; $("#topic").focus(); return; }
      resolveAndMaybeDiagnose(text);
    });
    document.addEventListener("click", (e) => {
      const chip = e.target.closest("#suggest .chip, #quickChips .chip");
      if (!chip) return;
      const c = { id: chip.dataset.id, name: chip.dataset.name };
      setSelected(c);
      $("#topic").value = c.name;
      diagnose(c.id, c.name);
    });

    // voice
    if (!Recognition) return; // unsupported: the mic stays hidden, typing works
    const mic = $("#micBtn"), status = $("#voiceStatus");
    mic.hidden = false;
    let session = null;
    const setVoice = (s, detail) => {
      mic.classList.toggle("listening", s === "listening");
      mic.classList.toggle("error", s === "error");
      mic.setAttribute("aria-pressed", String(s === "listening"));
      mic.setAttribute("aria-label", s === "listening" ? "Stop listening" : "Speak your topic");
      status.classList.toggle("err", s === "error");
      if (s === "listening") status.textContent = "Listening... say the topic you're stuck on.";
      if (s === "processing") status.textContent = "Got it. Matching that to a topic...";
      if (s === "error") status.textContent = VOICE_ERRORS[detail] || "Voice didn't work this time. Typing works fine.";
      if (s === "idle" && !$("#topic").value) status.textContent = "";
      if (s !== "listening") session = null;
    };
    mic.addEventListener("click", () => {
      if (session) { session.stop(); return; }
      stopSpeaking();
      $("#suggest").innerHTML = "";
      session = listen({
        onState: setVoice,
        onInterim: (t) => { $("#topic").value = t; status.innerHTML = `Hearing: <span class="voice-heard">“${esc(t)}”</span>`; },
        onFinal: (t) => {
          $("#topic").value = t;
          setVoice("idle");
          status.innerHTML = `Heard <span class="voice-heard">“${esc(t)}”</span>. Edit it if needed.`;
          resolveAndMaybeDiagnose(t, { fromVoice: true });
        },
      });
    });
  }

  // ------------------------------------------------------------------ diagnose
  function skeletonHTML() {
    return `<div class="skeleton" aria-label="Tracing your prerequisites">
      <div class="sk sk-card"></div>
      <div class="sk-root">${[0, 1, 2, 3].map(() => `<div class="sk-row"><div class="sk sk-dot"></div><div class="sk sk-line" style="width:${50 + Math.random() * 35}%"></div></div>`).join("")}</div>
    </div>`;
  }
  function errorHTML(msg, action) {
    return `<div class="error-state" role="alert">${icon("warning")}<p class="error-title">That didn't work</p><p>${esc(msg)}</p>
      ${action ? `<button class="btn btn-secondary" type="button" data-action="${action}">Try again</button>` : ""}</div>`;
  }
  let lastAsk = null;
  async function diagnose(conceptId, name) {
    if (!state.student) return showPicker();
    lastAsk = [conceptId, name];
    stopSpeaking();
    const box = $("#results");
    box.classList.remove("has-data");
    box.setAttribute("aria-busy", "true");
    box.innerHTML = `<p class="sr-only">Tracing ${esc(name || "your topic")} back to its roots...</p>` + skeletonHTML();
    $("#findBtn").disabled = true;
    try {
      const d = await api("/api/diagnose", { student_id: state.student.id, concept_id: conceptId });
      state.diagnosis = d; state.lastChange = null;
      store.set("diag:" + state.student.id, d);
      renderResults(d, { animate: true });
      box.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    } catch (e) {
      box.innerHTML = errorHTML(e.message, "retry-diagnose");
    } finally {
      box.setAttribute("aria-busy", "false");
      $("#findBtn").disabled = false;
    }
  }

  function countUp(el, to) {
    if (to === null || to === undefined) return;
    if (reduced()) { el.firstChild.textContent = to; return; }
    const t0 = performance.now(), dur = 600;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.firstChild.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function shareText(d) {
    const lines = [
      `RootCause check for ${d.stuck.name} (IFT 211)`,
      `Root cause: ${d.root.name} (${pct(d.root.score)})`,
      d.explanation || "",
      "",
      ...d.plan.map((day) => `Day ${day.day}: ${day.items.map((i) => i.name).join(", ")}`),
      "",
      location.origin,
    ];
    return lines.join("\n");
  }

  function rootCardHTML(d, animateNumber) {
    const r = d.root;
    const steps = r.hops === 1 ? "1 step" : `${r.hops} steps`;
    const kicker = r.is_self ? `Your foundations hold. Work on ${esc(d.stuck.name)} itself.` : `Start here, ${steps} below ${esc(d.stuck.name)}`;
    const shown = r.score === null || r.score === undefined ? "–" : (animateNumber && !reduced() ? 0 : r.score);
    return `<article class="card rc-card" aria-labelledby="rcName">
      <span class="rc-sticker">${icon("root")}Root cause</span>
      <p class="rc-kicker"><span>${kicker}</span></p>
      <h2 class="rc-name" id="rcName">${esc(r.name)}</h2>
      <div class="rc-score">
        <span class="rc-number" id="rcNumber" aria-label="Your score ${esc(pct(r.score))}">${shown}${r.score === null || r.score === undefined ? "" : "<small>%</small>"}</span>
        ${badge(r.status)}
      </div>
      <p class="rc-why">${esc(d.explanation || "")}</p>
      <p class="rc-source">${d.explanation_source === "ai" ? "Explained by Claude from your graph results" : "Explained from your graph results"}</p>
      <div class="rc-actions">
        <button class="btn btn-primary" type="button" data-action="quiz">Test me on ${esc(r.name)}</button>
        ${speakerHTML("diagnosis")}
        <a class="btn btn-ghost" href="https://wa.me/?text=${encodeURIComponent(shareText(d))}" target="_blank" rel="noopener" aria-label="Share to WhatsApp">${icon("share")}<span>WhatsApp</span></a>
      </div>
    </article>`;
  }

  function chainHTML(d, { animate, healedId } = {}) {
    const n = d.chain.length;
    const seg = n > 1 ? 0.6 / (n - 1) : 0.6;
    const items = d.chain.map((c, i) => {
      const cls = ["node", c.is_stuck ? "current" : "", c.is_root ? "root" : "", c.id === healedId ? "healed" : ""].join(" ");
      const tag = c.is_root && c.is_stuck ? "Root cause and your topic" : c.is_root ? "Root cause" : c.is_stuck ? "Where you're stuck" : "";
      return `<li class="${cls}" data-s="${esc(c.status)}" data-id="${esc(c.id)}" style="--seg-delay:${(i * seg).toFixed(3)}s;--seg-dur:${seg.toFixed(3)}s;--dot-delay:${(i * seg).toFixed(3)}s">
        <span class="seg" aria-hidden="true"></span>
        <span class="node-dot" aria-hidden="true">${icon(c.is_root ? "root" : STATUS_ICON[c.status])}</span>
        <div class="node-body">
          ${tag ? `<span class="node-tag">${tag}</span>` : ""}
          <span class="node-name">${esc(c.name)}</span>
          <span class="node-meta">${badge(c.status)}<span class="num">${esc(pct(c.score))}</span></span>
        </div>
      </li>`;
    }).join("");
    return `<section class="card" aria-labelledby="chainTitle">
      <div class="section-head">
        <h2 class="section-title" id="chainTitle">How we traced it</h2>
        <button class="btn btn-secondary map-open" type="button" data-action="openmap" aria-haspopup="dialog">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Open root map</span>
        </button>
      </div>
      <ol class="rootline${animate && !reduced() ? " drawing" : ""}" aria-label="From the topic you're stuck on down to its root cause">${items}</ol>
    </section>`;
  }

  // plan ---------------------------------------------------------------
  const doneKey = () => `done:${state.student?.id}:${state.diagnosis?.stuck.id}`;
  function planHTML(d, where) {
    const done = new Set(store.get(doneKey(), []));
    return `<div class="plan">${d.plan.map((day) => `
      <section class="card day" aria-labelledby="day${day.day}${where}">
        <div class="day-head"><h3 class="day-title" id="day${day.day}${where}">Day ${day.day}</h3><span class="day-time">${day.minutes} min</span></div>
        <ul class="tasks">${day.items.map((it, i) => {
          const key = `${day.day}:${it.id}:${i}`, id = `t-${where}-${day.day}-${i}`, isDone = done.has(key);
          return `<li class="task${isDone ? " done" : ""}">
            <label class="tick" for="${id}"><input type="checkbox" id="${id}" data-key="${esc(key)}" ${isDone ? "checked" : ""}><span class="tick-box">${icon("check")}</span><span class="sr-only">Mark ${esc(it.name)} done</span></label>
            <div class="task-body">
              <span class="task-name">${esc(it.name)}</span>
              <span class="task-text">${esc(it.task)}</span>
              <span class="task-meta">${badge(it.status)}<span class="time">${it.minutes} min</span></span>
              ${notesHTML(it)}
            </div>
          </li>`;
        }).join("")}</ul>
      </section>`).join("")}</div>`;
  }
  function notesHTML(it) {
    const n = it.notes;
    if (!n || !n.points || !n.points.length) return "";
    return `<details class="notes">
      <summary>Study notes</summary>
      <ul class="notes-points">${n.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      ${n.example ? `<p class="notes-ex"><b>Example</b>${esc(n.example)}</p>` : ""}
      ${n.trap ? `<p class="notes-trap"><b>Watch out</b>${esc(n.trap)}</p>` : ""}
      ${n.links && n.links.length ? `<p class="notes-links">${n.links.map(esc).join(" ")}</p>` : ""}
    </details>`;
  }
  document.addEventListener("change", (e) => {
    const cb = e.target.closest(".tick input");
    if (!cb) return;
    const done = new Set(store.get(doneKey(), []));
    cb.checked ? done.add(cb.dataset.key) : done.delete(cb.dataset.key);
    store.set(doneKey(), [...done]);
    $$(`.tick input[data-key="${CSS.escape(cb.dataset.key)}"]`).forEach((x) => { x.checked = cb.checked; x.closest(".task").classList.toggle("done", cb.checked); });
    if (cb.checked) toast(done.size === totalTasks() ? "Plan complete. Time for a fresh check." : "Nice. One step closer.");
  });
  const totalTasks = () => state.diagnosis ? state.diagnosis.plan.reduce((n, d) => n + d.items.length, 0) : 0;

  function changeHTML(res) {
    if (!res) return "";
    const u = res.update;
    const next = res.root_changed
      ? `<p>Next root to fix: <b>${esc(res.diagnosis.root.name)}</b>. Your plan has moved on.</p>`
      : res.diagnosis.root.is_self ? `<p>Your foundations look solid now. Practise ${esc(res.diagnosis.stuck.name)} itself.</p>`
      : `<p>${esc(u.name)} is still the root. One more round should do it.</p>`;
    return `<div class="change" role="status">
      <p class="change-title">${esc(res.message)}</p>
      <div class="change-row"><b>${esc(u.name)}</b></div>
      <div class="change-row">${badge(u.before)}<span class="num">${esc(pct(u.before_score))}</span><span class="arrow" aria-label="changed to">to</span>${badge(u.after)}<span class="num">${esc(pct(u.after_score))}</span></div>
      ${next}
    </div>`;
  }

  function renderResults(d, { animate = false, change = null, healedId = null } = {}) {
    const box = $("#results");
    const firstDay = d.plan[0]?.items[0];
    box.innerHTML = `
      <div class="col">
        ${changeHTML(change)}
        ${rootCardHTML(d, animate)}
        ${chainHTML(d, { animate, healedId })}
        <div class="card plan-teaser">
          <div><p class="subtitle">Your 3-day plan</p><p class="muted">Day 1 starts with ${esc(firstDay?.name || d.root.name)}.</p></div>
          <a class="btn btn-secondary" href="#plan">Open plan</a>
        </div>
      </div>
      <div class="col plan-inline">
        <div class="section-head"><h2 class="section-title">Your 3-day plan</h2>${speakerHTML("plan")}</div>
        ${planHTML(d, "i")}
      </div>`;
    box.classList.add("has-data");
    $("#homeMain").classList.add("has-results");
    if (animate) countUp($("#rcNumber"), d.root.score);
  }

  // ------------------------------------------------------------------ full-screen root map
  let mapOpener = null;
  function closeMap() {
    const layer = $("#mapLayer");
    if (!layer) return;
    layer.remove();
    document.body.classList.remove("map-open-body");
    document.removeEventListener("keydown", mapKeys, true);
    mapOpener?.focus();
  }
  function mapKeys(e) {
    if (e.key === "Escape") { e.preventDefault(); closeMap(); return; }
    if (e.key !== "Tab") return;
    const layer = $("#mapLayer");
    const f = $$("button, a[href]", layer).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function openMap(opener) {
    const d = state.diagnosis;
    if (!d) return;
    stopSpeaking();
    mapOpener = opener || null;
    const layer = document.createElement("div");
    layer.id = "mapLayer";
    layer.className = "map-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-labelledby", "mapTitle");
    layer.innerHTML = `
      <div class="map-bar">
        <div class="map-bar-title">
          <svg class="brand-mark" aria-hidden="true"><use href="#i-root"/></svg>
          <div><h2 id="mapTitle">Root map</h2><p>${esc(d.stuck.name)}, ${d.graph.nodes.length} topics underneath</p></div>
        </div>
        <button class="gpill map-close" type="button" data-action="closemap">Close</button>
      </div>
      ${RootArt.mapHTML(d)}`;
    document.body.appendChild(layer);
    document.body.classList.add("map-open-body");
    document.addEventListener("keydown", mapKeys, true);
    RootArt.initMap(d, {
      pct,
      onQuiz: () => { closeMap(); startQuiz(); },
      onDiagnose: (id, name) => { closeMap(); $("#topic").value = name; diagnose(id, name); },
    });
    $(".map-close", layer).focus();
  }

  // ------------------------------------------------------------------ plan view
  function emptyHTML(title, text) {
    return `<div class="empty">
      <div class="empty-art">${RootArt.heroArt()}</div>
      <p class="empty-title">${esc(title)}</p><p class="muted">${esc(text)}</p>
      <a class="btn btn-primary" href="#home">Find the root</a></div>`;
  }
  function renderPlanView() {
    const d = state.diagnosis;
    if (!d) {
      $("#planLead").textContent = "Deepest roots first. Tick each one off as you go.";
      $("#planBody").innerHTML = emptyHTML("No plan yet", "Tell me what you're stuck on and I'll build one that starts at the real problem.");
      return;
    }
    $("#planLead").textContent = `For ${d.stuck.name}, starting at ${d.root.name}. Deepest roots first.`;
    $("#planBody").innerHTML = `<div class="btn-row" style="margin-bottom:var(--s4)">${speakerHTML("plan", "Listen to plan")}<button class="btn btn-secondary" type="button" data-action="quiz">Test me on ${esc(d.root.name)}</button></div>${planHTML(d, "p")}`;
  }

  // ------------------------------------------------------------------ progress
  async function loadProgress() {
    const body = $("#progressBody");
    if (!state.student) { body.innerHTML = emptyHTML("Pick a student first", "Choose who's studying on the Home screen."); return; }
    if (!state.overview) body.innerHTML = `<div class="skeleton"><div class="sk sk-card" style="height:140px"></div><div class="sk-root">${[0, 1, 2, 3, 4].map(() => `<div class="sk-row"><div class="sk sk-dot"></div><div class="sk sk-line" style="width:70%"></div></div>`).join("")}</div></div>`;
    try {
      state.overview = await api("/api/overview/" + encodeURIComponent(state.student.id));
      store.set("overview:" + state.student.id, state.overview);
    } catch (e) {
      state.overview = store.get("overview:" + state.student.id);
      if (!state.overview) { body.innerHTML = errorHTML(e.message, "retry-progress"); return; }
    }
    renderProgress();
  }
  function renderProgress() {
    const o = state.overview, c = o.counts, total = o.concepts.length;
    const filters = ["All", "Weak", "Okay", "Strong", "Not tried"];
    const rows = o.concepts.filter((x) => state.filter === "All" || x.status === state.filter);
    const units = UNIT_ORDER.map((u) => [u, rows.filter((x) => x.unit === u)]).filter(([, xs]) => xs.length);
    const flex = (n) => `style="flex-grow:${n}"`;
    $("#progressBody").innerHTML = `
      <section class="card summary" aria-labelledby="sumTitle">
        <h2 class="sr-only" id="sumTitle">Summary</h2>
        <p class="summary-hero"><span class="rc-number">${c.Strong}</span><span class="lead">of ${total} topics strong</span></p>
        <div class="segbar" aria-hidden="true"><span class="w" ${flex(c.Weak)}></span><span class="o" ${flex(c.Okay)}></span><span class="s" ${flex(c.Strong)}></span><span class="n" ${flex(c["Not tried"])}></span></div>
        <ul class="legend">${["Weak", "Okay", "Strong", "Not tried"].map((s) => `<li>${badge(s)}<b>${c[s]}</b></li>`).join("")}</ul>
      </section>
      <div class="chips filters" role="group" aria-label="Filter topics">${filters.map((f) => `<button class="chip" type="button" data-filter="${esc(f)}" aria-pressed="${state.filter === f}">${icon("check")}<span>${esc(f)}</span></button>`).join("")}</div>
      ${units.length ? units.map(([u, xs]) => `
        <section class="unit" aria-labelledby="u-${esc(u.replace(/\W/g, ""))}">
          <h2 class="unit-title" id="u-${esc(u.replace(/\W/g, ""))}">${esc(u)}</h2>
          <ul class="concepts">${xs.map((x) => `
            <li class="crow" data-s="${esc(x.status)}">
              <span class="node-dot" aria-hidden="true">${icon(STATUS_ICON[x.status])}</span>
              <span class="crow-name">${esc(x.name)}${state.lastChange === x.id ? ` <span class="badge" data-s="Strong">${icon("check")}Just updated</span>` : ""}<span class="crow-sub" style="display:block">${x.unlocks ? `Unlocks ${x.unlocks} later ${x.unlocks === 1 ? "topic" : "topics"}` : "Builds on the rest"}</span></span>
              <span class="crow-score">${x.score === null || x.score === undefined ? "" : `<span class="num">${x.score}%</span>`}${badge(x.status)}</span>
            </li>`).join("")}</ul>
        </section>`).join("") : `<p class="muted">No topics in this group yet.</p>`}`;
  }
  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-filter]");
    if (f) { state.filter = f.dataset.filter; renderProgress(); $(`[data-filter="${CSS.escape(state.filter)}"]`)?.focus(); }
  });

  // ------------------------------------------------------------------ quiz
  async function startQuiz() {
    const d = state.diagnosis;
    if (!d) return;
    state.quiz = { loading: true }; state.result = null;
    location.hash = "#quiz";
    $("#quizTitle").textContent = `Quick check: ${d.root.name}`;
    const body = $("#quizBody");
    body.innerHTML = `<div class="skeleton" aria-label="Writing your questions"><div class="sk sk-line" style="width:40%"></div><div class="sk sk-line" style="height:28px"></div>${[0, 1, 2, 3].map(() => `<div class="sk" style="height:56px"></div>`).join("")}</div>`;
    VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== "quiz"; });
    try {
      state.quiz = await api("/api/quiz/generate", { student_id: state.student.id, concept_id: d.root.id });
      state.qIndex = 0; state.answers = state.quiz.questions.map(() => null);
      renderQuestion();
    } catch (e) { body.innerHTML = errorHTML(e.message, "quiz"); }
  }
  function renderQuestion(heard) {
    if (!state.quiz || !state.quiz.questions) return;
    const q = state.quiz.questions[state.qIndex], n = state.quiz.questions.length, sel = state.answers[state.qIndex];
    const last = state.qIndex === n - 1;
    $("#quizBody").innerHTML = `
      <div class="qprog" aria-hidden="true">${state.quiz.questions.map((_, i) => `<span class="${i <= state.qIndex ? "on" : ""}"></span>`).join("")}</div>
      <div class="section-head" style="margin-bottom:0"><p class="qcount">Question ${state.qIndex + 1} of ${n}</p>${speakerHTML("question")}</div>
      <h2 class="qtext" id="qtext">${esc(q.prompt)}</h2>
      <ol class="options" aria-labelledby="qtext">${q.options.map((o, i) => `
        <li><button class="opt" type="button" data-opt="${i}" aria-pressed="${sel === i}">
          <span class="opt-key" aria-hidden="true">${"ABCD"[i]}</span><span class="opt-text"><span class="sr-only">Option ${"ABCD"[i]}: </span>${esc(o)}</span><span class="opt-icon">${icon("check")}</span>
        </button></li>`).join("")}</ol>
      ${heard !== undefined ? `<div class="heard" role="status">${heard === null ? `<span>I didn't catch a letter. Try “B” or “the second one”.</span>` : `<span>I heard <b>${"ABCD"[heard]}</b>. Tap to confirm.</span><button class="btn btn-secondary" type="button" data-confirm="${heard}">Confirm ${"ABCD"[heard]}</button>`}</div>` : ""}
      <p class="voice-status" id="quizVoice" aria-live="polite"></p>
      <div class="qfoot">
        ${state.qIndex > 0 ? `<button class="btn btn-ghost" type="button" data-action="qprev">Previous</button>` : ""}
        ${Recognition ? `<button class="btn btn-ghost" type="button" data-action="qvoice" aria-label="Answer by voice">${icon("mic")}<span>Say it</span></button>` : ""}
        <button class="btn btn-primary" type="button" data-action="${last ? "qsubmit" : "qnext"}" ${sel === null ? "disabled" : ""}>${last ? "Check my answers" : "Next question"}</button>
      </div>`;
  }
  function parseSpokenOption(t, options) {
    const s = t.toLowerCase().replace(/[.,!?]/g, " ").trim();
    const ordinals = [["first", "one", "1"], ["second", "two", "2"], ["third", "three", "3"], ["fourth", "four", "4", "last"]];
    const letter = s.match(/\b(?:option|letter|answer)?\s*([abcd])\b/);
    if (letter && (s.length <= 12 || /option|letter|answer/.test(s))) return "abcd".indexOf(letter[1]);
    for (let i = 0; i < 4; i++) if (ordinals[i].some((w) => new RegExp(`\\b${w}\\b`).test(s))) return i;
    if (/^(ay|eh|hey)$/.test(s)) return 0;
    if (/^(bee|be)$/.test(s)) return 1;
    if (/^(see|sea|si)$/.test(s)) return 2;
    if (/^(dee|the)$/.test(s)) return 3;
    const hit = options.findIndex((o) => s.length > 3 && o.toLowerCase().includes(s));
    return hit >= 0 ? hit : null;
  }
  async function submitQuiz() {
    const body = $("#quizBody");
    body.innerHTML = `<div class="skeleton" aria-label="Checking your answers"><div class="sk sk-card" style="height:120px"></div><div class="sk" style="height:80px"></div></div>`;
    try {
      const res = await api("/api/quiz/submit", { student_id: state.student.id, quiz_id: state.quiz.quiz_id, stuck_id: state.diagnosis.stuck.id, answers: state.answers });
      state.result = res;
      renderReview();
    } catch (e) { body.innerHTML = errorHTML(e.message, "qsubmit-retry"); }
  }
  function renderReview() {
    const res = state.result, qs = state.quiz.questions;
    $("#quizBody").innerHTML = `
      <section class="card score-hero" aria-labelledby="scoreT">
        <h2 class="sr-only" id="scoreT">Your result</h2>
        <p class="score-big num">${res.correct}/${res.total}</p>
        <p class="lead">${esc(res.message)}</p>
        <p class="change-row">${badge(res.update.before)}<span class="num">${esc(pct(res.update.before_score))}</span><span class="arrow">to</span>${badge(res.update.after)}<span class="num">${esc(pct(res.update.after_score))}</span></p>
      </section>
      <div class="review" style="margin-top:var(--s5)">${qs.map((q, i) => {
        const r = res.results[i];
        return `<section class="review-q" aria-label="Question ${i + 1}">
          <h3 class="subtitle" style="font-size:var(--fs-lead)">${i + 1}. ${esc(q.prompt)}</h3>
          <ol class="options" style="margin:0">${q.options.map((o, j) => {
            const cls = j === r.answer ? "correct" : j === r.chosen ? "wrong" : "";
            const label = j === r.answer ? (j === r.chosen ? "Your answer, correct" : "Correct answer") : j === r.chosen ? "Your answer, not quite" : "";
            return `<li><button class="opt reveal ${cls}" type="button" disabled>
              <span class="opt-key" aria-hidden="true">${"ABCD"[j]}</span><span class="opt-text">${esc(o)}${label ? `<span class="sr-only"> (${label})</span>` : ""}</span>
              <span class="opt-icon">${cls === "correct" ? icon("check") : cls === "wrong" ? icon("cross") : ""}</span></button></li>`;
          }).join("")}</ol>
          <p class="review-why">${esc(r.why)}</p>
        </section>`;
      }).join("")}</div>
      <div class="qfoot"><button class="btn btn-primary" type="button" data-action="seechange">See what changed</button></div>`;
    $("#quizBody .score-big")?.focus?.();
  }
  function playUpdate() {
    const res = state.result, before = state.diagnosis;
    state.quiz = null;
    state.lastChange = res.update.id;
    state.overview = null;
    location.hash = "#home";
    const after = res.diagnosis;
    const commit = () => {
      state.diagnosis = after;
      store.set("diag:" + state.student.id, after);
    };
    if (reduced() || !before) {
      commit();
      renderResults(after, { animate: false, change: res, healedId: res.update.id });
      return;
    }
    // 1. show the chain they quizzed on, 2. heal the node in place, 3. redraw the new chain.
    renderResults(before, { animate: false, change: res });
    setTimeout(() => $(".rootline")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    setTimeout(() => {
      const li = $(`.rootline li[data-id="${CSS.escape(res.update.id)}"]`);
      if (li) {
        li.dataset.s = res.update.after;
        li.classList.add("healed");
        $(".node-meta", li).innerHTML = `${badge(res.update.after)}<span class="num">${esc(pct(res.update.after_score))}</span>`;
        if (!li.classList.contains("root")) $(".node-dot", li).innerHTML = icon(STATUS_ICON[res.update.after]);
      }
    }, 650);
    setTimeout(() => {
      commit();
      renderResults(after, { animate: res.root_changed, change: res, healedId: res.root_changed ? null : res.update.id });
    }, res.root_changed ? 2100 : 1400);
  }

  // ------------------------------------------------------------------ global actions
  document.addEventListener("click", (e) => {
    const sc = e.target.closest("[data-student]");
    if (sc) { chooseStudent(sc.dataset.student); $("#topic").focus(); return; }
    const opt = e.target.closest("[data-opt]");
    if (opt && !opt.disabled) { state.answers[state.qIndex] = Number(opt.dataset.opt); renderQuestion(); $(`[data-opt="${opt.dataset.opt}"]`).focus(); return; }
    const conf = e.target.closest("[data-confirm]");
    if (conf) { state.answers[state.qIndex] = Number(conf.dataset.confirm); renderQuestion(); $(`[data-opt="${conf.dataset.confirm}"]`).focus(); return; }
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const act = a.dataset.action;
    if (act === "quiz") startQuiz();
    if (act === "openmap") openMap(a);
    if (act === "closemap") closeMap();
    if (act === "retry-diagnose" && lastAsk) diagnose(...lastAsk);
    if (act === "retry-progress") loadProgress();
    if (act === "retry-students") loadStudents();
    if (act === "qnext") { stopSpeaking(); state.qIndex++; renderQuestion(); $("#qtext").setAttribute("tabindex", "-1"); $("#qtext").focus(); }
    if (act === "qprev") { stopSpeaking(); state.qIndex--; renderQuestion(); }
    if (act === "qsubmit" || act === "qsubmit-retry") { stopSpeaking(); submitQuiz(); }
    if (act === "seechange") playUpdate();
    if (act === "qvoice") {
      stopSpeaking();
      const st = $("#quizVoice");
      listen({
        onState: (s, detail) => {
          if (s === "listening") st.textContent = "Listening... say A, B, C or D.";
          if (s === "error") st.textContent = VOICE_ERRORS[detail] || "Voice didn't work. Just tap an answer.";
        },
        onInterim: (t) => { st.textContent = `Hearing “${t}”`; },
        onFinal: (t) => renderQuestion(parseSpokenOption(t, state.quiz.questions[state.qIndex].options)),
      });
    }
  });
  $("#quizBack").addEventListener("click", () => { stopSpeaking(); state.quiz = null; location.hash = "#home"; });
  $("#studentSwitch").addEventListener("click", showPicker);

  // ------------------------------------------------------------------ offline + chrome
  function paintOnline() { $("#offline").hidden = navigator.onLine; }
  addEventListener("online", paintOnline);
  addEventListener("offline", paintOnline);
  addEventListener("scroll", () => $(".appbar").classList.toggle("scrolled", scrollY > 4), { passive: true });
  addEventListener("hashchange", route);

  async function boot() {
    $$("[data-art]").forEach((el) => { el.innerHTML = RootArt.heroArt(); });
    initTheme();
    initAsk();
    paintOnline();
    await loadStudents();
    const saved = store.get("student");
    if (saved && state.students.some((s) => s.id === saved)) chooseStudent(saved);
    else { $("#picker").hidden = false; }
    route();
    const splash = $("#splash");
    setTimeout(() => { splash.classList.add("done"); setTimeout(() => splash.remove(), 400); }, reduced() ? 0 : 750);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  boot();
})();
