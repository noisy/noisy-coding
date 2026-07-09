"""Self-contained live dashboard served by the listener daemon at GET /."""

DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>grok-voice — live view</title>
<style>
  :root {
    --paper: #FBFAF6; --surface: #FFFFFF; --ink: #23262B; --muted: #6E6A61;
    --line: #E4E1D7; --teal: #0E9F87; --teal-soft: #E0F2EE; --amber: #C2760A;
    --amber-soft: #F8ECDC; --violet: #7C5CBF; --violet-soft: #EEE9F8;
    --red: #C2483B; --red-soft: #F8E3E0; --code-bg: #F1EFE8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #15171B; --surface: #1D2026; --ink: #E9E7E1; --muted: #9A968C;
      --line: #2D3038; --teal: #2FC4A7; --teal-soft: #16332E; --amber: #E5963C;
      --amber-soft: #35281A; --violet: #A88BE0; --violet-soft: #2A2438;
      --red: #E06A5D; --red-soft: #3A2320; --code-bg: #24272E;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 28px 18px 60px;
  }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 1.3rem; letter-spacing: -0.01em; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 0.85rem; margin: 0 0 20px; }

  .statusbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 20px; }
  .chip {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1px solid var(--line); background: var(--surface);
    border-radius: 999px; padding: 7px 15px; font-size: 0.88rem; font-weight: 600;
  }
  .chip .num { font-variant-numeric: tabular-nums; }
  .chip small { color: var(--muted); font-weight: 500; }
  button.chip { cursor: pointer; font: inherit; color: inherit; }
  button.chip:hover { border-color: var(--teal); }
  button.chip:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
  #mode-label { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  #mode-label.live { color: var(--amber); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); }
  .chip.listening .dot { background: var(--teal); animation: pulse 2s infinite; }
  .chip.recording .dot { background: var(--amber); animation: pulse 0.7s infinite; }
  .chip.muted .dot { background: var(--violet); }
  .chip.offline .dot { background: var(--red); }
  @keyframes pulse { 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .dot, .card.live { animation: none !important; } }

  details.rules {
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
    padding: 10px 18px; margin-bottom: 22px; font-size: 0.85rem;
  }
  details.rules summary { cursor: pointer; font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); font-weight: 600; }
  .rules table { border-collapse: collapse; width: 100%; margin-top: 10px; }
  .rules td { padding: 4px 12px 4px 0; vertical-align: top; }
  .rules td:first-child {
    font-family: ui-monospace, Menlo, monospace; font-weight: 600;
    white-space: nowrap; color: var(--amber);
  }
  .rules td:last-child { color: var(--muted); }

  .sliders { display: grid; gap: 10px; margin-top: 12px; }
  .sliders label {
    display: grid; grid-template-columns: 168px 1fr 42px; gap: 10px;
    align-items: center; font-size: 0.85rem; font-weight: 600;
  }
  .sliders .name small { display: block; color: var(--muted); font-weight: 400; font-size: 0.72rem; }
  .sliders select {
    font: inherit; color: inherit; background: var(--paper);
    border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px;
  }
  .sliders input[type="range"] { width: 100%; accent-color: var(--teal); }
  .sliders .val { font-family: ui-monospace, Menlo, monospace; font-size: 0.8rem;
    color: var(--teal); text-align: right; font-variant-numeric: tabular-nums; }

  #cards { display: flex; flex-direction: column; gap: 12px; }
  .card {
    background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
    padding: 13px 16px; max-width: 88%;
  }
  .card.user { align-self: flex-end; border-right: 4px solid var(--amber); }
  .card.claude { align-self: flex-start; border-left: 4px solid var(--violet); }
  .card.live { animation: breathe 1.2s infinite; }
  @keyframes breathe { 50% { border-color: var(--amber); } }

  .card .head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .card .who {
    font-family: ui-monospace, Menlo, monospace; font-size: 0.68rem; font-weight: 700;
    letter-spacing: 0.09em;
  }
  .card.user .who { color: var(--amber); }
  .card.claude .who { color: var(--violet); }
  .card .status {
    font-size: 0.72rem; font-weight: 650; padding: 2px 10px; border-radius: 999px;
    background: var(--code-bg); color: var(--muted); white-space: nowrap;
  }
  .card .status.phase-rec { background: var(--amber-soft); color: var(--amber); }
  .card .status.phase-work { background: var(--code-bg); color: var(--muted); }
  .card .status.phase-ready { background: var(--amber-soft); color: var(--amber); }
  .card .status.phase-done { background: var(--teal-soft); color: var(--teal); }
  .card .status.phase-spoken { background: var(--violet-soft); color: var(--violet); }
  .card .status.phase-bad { background: var(--red-soft); color: var(--red); }
  .card .t { font-family: ui-monospace, Menlo, monospace; font-size: 0.72rem; color: var(--muted); margin-left: auto; }
  .card .text { font-size: 0.97rem; line-height: 1.45; overflow-wrap: anywhere; }
  .card .text.pending { color: var(--muted); font-style: italic; }
  .card .foot { display: flex; gap: 12px; margin-top: 5px; font-size: 0.76rem;
    color: var(--muted); font-family: ui-monospace, Menlo, monospace; }
  .card .cost { margin-left: auto; font-variant-numeric: tabular-nums; }
  .empty { color: var(--muted); font-size: 0.9rem; padding: 24px 4px; }
</style>
</head>
<body>
<main>
  <h1>grok-voice — live view</h1>
  <p class="sub">Every utterance is a card with a live status: recording → transcription → text → delivery.</p>

  <div class="statusbar">
    <span class="chip" id="state"><span class="dot"></span><span id="state-label">connecting…</span></span>
    <span class="chip"><span class="num" id="queued">0</span>&nbsp;<small>queued</small></span>
    <span class="chip"><small>session</small>&nbsp;<span class="num" id="cost">$0.0000</span></span>
    <span class="chip" id="credits-chip" hidden><small>credits left</small>&nbsp;<span class="num" id="credits"></span></span>
    <button class="chip" id="mode-toggle" type="button" title="Batch: transcribe after you stop talking ($0.10/h). Live: stream while you talk, text appears as you speak ($0.20/h).">
      <small>mode</small>&nbsp;<span id="mode-label">…</span>
    </button>
    <button class="chip" id="mute-toggle" type="button" title="Stop transcribing the mic (e.g. while talking to someone else). Claude keeps working; nothing you say reaches him until you unmute.">
      🎤&nbsp;<span id="mute-label">…</span>
    </button>
  </div>

  <details class="rules" open>
    <summary>Character</summary>
    <div class="sliders">
      <label><span class="name">Humor <small>dry ↔ playful</small></span>
        <input type="range" id="ch-humor" min="0" max="100" step="5"><span class="val" id="ch-humor-val"></span></label>
      <label><span class="name">Honesty <small>diplomatic ↔ blunt</small></span>
        <input type="range" id="ch-honesty" min="0" max="100" step="5"><span class="val" id="ch-honesty-val"></span></label>
      <label><span class="name">Brevity <small>detailed ↔ terse</small></span>
        <input type="range" id="ch-brevity" min="0" max="100" step="5"><span class="val" id="ch-brevity-val"></span></label>
      <label><span class="name">Chatty <small>milestones only ↔ frequent updates</small></span>
        <input type="range" id="ch-chatty" min="0" max="100" step="5"><span class="val" id="ch-chatty-val"></span></label>
      <label><span class="name">Voice <small>who speaks to you</small></span>
        <select id="ch-voice"></select><span class="val"></span></label>
      <label><span class="name">Speed <small>0.7× ↔ 1.5×</small></span>
        <input type="range" id="ch-speed" min="0.7" max="1.5" step="0.05"><span class="val" id="ch-speed-val"></span></label>
      <label><span class="name">Pause split <small>silence that ends an utterance</small></span>
        <input type="range" id="ch-silence" min="500" max="4000" step="100"><span class="val" id="ch-silence-val"></span></label>
    </div>
  </details>

  <details class="rules">
    <summary>Timing rules</summary>
    <table>
      <tr><td>&lt; 0.8s</td><td>a pause while speaking — nothing happens, still one utterance</td></tr>
      <tr><td>0.8s silence</td><td>VAD closes the utterance and sends it for transcription (~1s)</td></tr>
      <tr><td>2s silence</td><td>after a transcript: the grace period ends and Claude wakes with everything; speaking again extends the wait (max 20s)</td></tr>
      <tr><td>5 min</td><td>how long the background hook keeps listening after a turn ends</td></tr>
    </table>
  </details>

  <div id="cards"><div class="empty" id="empty">Say something — the first card will appear here.</div></div>
</main>
<script>
  const PHASE = s =>
    s.startsWith("recording") ? "rec" :
    s.startsWith("transcribing") || s.startsWith("synthesizing") ? "work" :
    s.startsWith("ready") ? "ready" :
    s.startsWith("delivered") ? "done" :
    s.startsWith("playing") || s === "played" ? "spoken" :
    // empty / dropped / error — an utterance that never became text
    (s.startsWith("empty") || s.startsWith("dropped") || s.indexOf("error") >= 0) ? "dead" :
    "bad";

  const cards = document.getElementById("cards");
  const seen = new Map();

  const fmtTime = ts => new Date(ts * 1000).toLocaleTimeString();
  const fmtCost = usd => usd >= 0.01 ? "$" + usd.toFixed(2) : "$" + usd.toFixed(4);
  const escapeHtml = s => s.replace(/[&<>"']/g,
    c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const renderBold = s => escapeHtml(s).replace(/\\*\\*(.+?)\\*\\*/g, "<b>$1</b>");

  function dropCard(id) {
    const el = seen.get(id);
    if (el) { el.remove(); seen.delete(id); }
  }

  function upsert(u) {
    // An utterance that never became text (cough, noise, silence) must not
    // linger on the board — drop it whether or not a card was shown.
    if (PHASE(u.status) === "dead") { dropCard(u.id); return; }
    document.getElementById("empty")?.remove();
    let el = seen.get(u.id);
    if (!el) {
      el = document.createElement("div");
      el.innerHTML =
        '<div class="head"><span class="who"></span><span class="status"></span>' +
        '<span class="t"></span></div><div class="text"></div>' +
        '<div class="foot"><span class="detail"></span><span class="cost"></span></div>';
      el.querySelector(".who").textContent = u.role === "user" ? "YOU" : "CLAUDE";
      el.querySelector(".t").textContent = fmtTime(u.started_at);
      cards.prepend(el);
      seen.set(u.id, el);
      while (cards.children.length > 60) {
        const last = cards.lastChild;
        for (const [id, node] of seen) if (node === last) seen.delete(id);
        last.remove();
      }
    }
    const phase = PHASE(u.status);
    el.className = "card " + u.role + (phase === "rec" ? " live" : "");
    const st = el.querySelector(".status");
    st.textContent = u.status;
    st.className = "status phase-" + phase;
    const txt = el.querySelector(".text");
    if (u.text) { txt.innerHTML = renderBold(u.text); txt.className = "text"; }
    else {
      txt.className = "text pending";
      txt.textContent = phase === "rec" ? "listening, keep talking…" :
                        phase === "work" ? "text will appear in a moment…" : "—";
    }
    el.querySelector(".detail").textContent = u.detail || "";
    el.querySelector(".cost").textContent = u.cost_usd ? fmtCost(u.cost_usd) : "";
  }

  function setState(cls, label) {
    const chip = document.getElementById("state");
    chip.className = "chip " + cls;
    document.getElementById("state-label").textContent = label;
  }

  const TRAITS = ["humor", "honesty", "brevity", "chatty"];
  const VOICES = {
    altair:"male", ara:"female", atlas:"male", carina:"female", castor:"male",
    celeste:"female", cosmo:"male", eve:"female", helios:"male", helix:"male",
    iris:"female", kepler:"male", leo:"male", lumen:"male", luna:"female",
    lux:"male", naksh:"male", orion:"male", perseus:"male", rex:"male",
    rigel:"male", sal:"male", sirius:"male", ursa:"female", zagan:"male",
    zenith:"male"
  };
  async function postCharacter() {
    const body = {
      voice: document.getElementById("ch-voice").value,
      speed: Number(document.getElementById("ch-speed").value),
    };
    for (const t of TRAITS) body[t] = Number(document.getElementById("ch-" + t).value);
    await fetch("/character", { method: "POST", body: JSON.stringify(body) });
  }
  function bindSliders() {
    for (const trait of TRAITS) {
      const input = document.getElementById("ch-" + trait);
      const val = document.getElementById("ch-" + trait + "-val");
      input.addEventListener("input", () => { val.textContent = input.value; });
      input.addEventListener("change", postCharacter);
    }
    const speed = document.getElementById("ch-speed");
    speed.addEventListener("input", () => {
      document.getElementById("ch-speed-val").textContent = Number(speed.value).toFixed(2) + "×";
    });
    speed.addEventListener("change", postCharacter);
    const silence = document.getElementById("ch-silence");
    silence.addEventListener("input", () => {
      document.getElementById("ch-silence-val").textContent = (silence.value / 1000).toFixed(1) + "s";
    });
    silence.addEventListener("change", async () => {
      await fetch("/settings", { method: "POST",
        body: JSON.stringify({ end_silence_ms: Number(silence.value) }) });
    });
    const select = document.getElementById("ch-voice");
    for (const [v, gender] of Object.entries(VOICES)) {
      const option = document.createElement("option");
      option.value = v;
      option.textContent = v[0].toUpperCase() + v.slice(1) + " (" + gender + ")";
      select.appendChild(option);
    }
    select.addEventListener("change", postCharacter);
  }
  async function loadCharacter() {
    try {
      const data = await (await fetch("/character")).json();
      for (const trait of TRAITS) {
        const input = document.getElementById("ch-" + trait);
        input.value = data.character[trait];
        document.getElementById("ch-" + trait + "-val").textContent = input.value;
      }
      document.getElementById("ch-voice").value = data.character.voice || "carina";
      const speedInput = document.getElementById("ch-speed");
      speedInput.value = data.character.speed || 1.0;
      document.getElementById("ch-speed-val").textContent =
        Number(speedInput.value).toFixed(2) + "×";
    } catch {}
  }
  bindSliders();
  loadCharacter();

  let currentMode = null;
  document.getElementById("mode-toggle").addEventListener("click", async () => {
    const next = currentMode === "live" ? "batch" : "live";
    await fetch("/mode", { method: "POST", body: JSON.stringify({ mode: next }) });
  });

  let currentMuted = false;
  document.getElementById("mute-toggle").addEventListener("click", async () => {
    await fetch("/mute", { method: "POST", body: JSON.stringify({ muted: !currentMuted }) });
  });
  function setMuted(muted) {
    currentMuted = muted;
    const label = document.getElementById("mute-label");
    label.textContent = muted ? "muted" : "listening";
    label.style.color = muted ? "var(--red)" : "";
  }
  function setMode(mode) {
    currentMode = mode;
    const label = document.getElementById("mode-label");
    label.textContent = mode;
    label.className = mode === "live" ? "live" : "";
  }

  async function tick() {
    try {
      const s = await (await fetch("/status")).json();
      document.getElementById("queued").textContent = s.queued;
      const costs = s.session_cost_usd || {};
      const total = (costs.user || 0) + (costs.claude || 0);
      document.getElementById("cost").textContent = fmtCost(total);
      document.getElementById("cost").title =
        "you " + fmtCost(costs.user || 0) + " · Claude " + fmtCost(costs.claude || 0);
      const creditsChip = document.getElementById("credits-chip");
      if (s.credits_usd != null) {
        creditsChip.hidden = false;
        document.getElementById("credits").textContent = "$" + s.credits_usd.toFixed(2);
      }
      setMode(s.mode || "batch");
      setMuted(!!s.muted);
      const silence = document.getElementById("ch-silence");
      if (s.end_silence_ms && document.activeElement !== silence) {
        silence.value = s.end_silence_ms;
        document.getElementById("ch-silence-val").textContent =
          (s.end_silence_ms / 1000).toFixed(1) + "s";
      }
      if (s.muted) setState("offline", "muted by you — mic ignored");
      else if (!s.listening) setState("muted", "muted — Claude is speaking");
      else if (s.recording) setState("recording", "recording your utterance");
      else setState("listening", "listening");
      const data = await (await fetch("/utterances")).json();
      for (const u of data.utterances) upsert(u);
    } catch {
      setState("offline", "daemon not responding");
    }
  }
  tick();
  setInterval(tick, 400);
</script>
</body>
</html>
"""
