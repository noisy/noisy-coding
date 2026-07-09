"""Self-contained live dashboard served by the listener daemon at GET /."""

DASHBOARD_HTML = """<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>grok-voice — podgląd na żywo</title>
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
    border-radius: 999px; padding: 7px 15px; font-size: 0.9rem; font-weight: 600;
  }
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
  .card .detail { font-size: 0.76rem; color: var(--muted); margin-top: 5px; font-family: ui-monospace, Menlo, monospace; }
  .empty { color: var(--muted); font-size: 0.9rem; padding: 24px 4px; }
</style>
</head>
<body>
<main>
  <h1>grok-voice — podgląd na żywo</h1>
  <p class="sub">Każda wypowiedź to karta, której status żyje: nagrywanie → transkrypcja → tekst → doręczenie.</p>

  <div class="statusbar">
    <span class="chip" id="state"><span class="dot"></span><span id="state-label">łączenie…</span></span>
    <span class="chip"><span id="queued">0</span>&nbsp;czeka na odbiór</span>
  </div>

  <details class="rules">
    <summary>Reguły czasowe</summary>
    <table>
      <tr><td>&lt; 0,8 s</td><td>pauza w mówieniu — nic się nie dzieje, to wciąż jedna wypowiedź</td></tr>
      <tr><td>0,8 s ciszy</td><td>VAD zamyka wypowiedź i wysyła ją do transkrypcji (~1 s)</td></tr>
      <tr><td>2 s ciszy</td><td>po transkrypcie: koniec „grace period” — Claude budzi się z całością; wznowienie mówienia przedłuża czekanie (maks. 20 s)</td></tr>
      <tr><td>5 min</td><td>tyle po zakończeniu tury hook czuwa w tle na twój głos</td></tr>
    </table>
  </details>

  <div id="cards"><div class="empty" id="empty">Powiedz coś — pierwsza karta pojawi się tutaj.</div></div>
</main>
<script>
  const PHASE = s =>
    s.startsWith("nagrywana") ? "rec" :
    s.startsWith("transkrypcja") || s.startsWith("synteza") ? "work" :
    s.startsWith("gotowa") ? "ready" :
    s.startsWith("dostarczona") ? "done" :
    s.startsWith("odtwarzam") || s === "odtworzona" ? "spoken" : "bad";

  const cards = document.getElementById("cards");
  const seen = new Map();

  function fmtTime(ts) { return new Date(ts * 1000).toLocaleTimeString("pl-PL"); }

  function upsert(u) {
    document.getElementById("empty")?.remove();
    let el = seen.get(u.id);
    if (!el) {
      el = document.createElement("div");
      el.innerHTML =
        '<div class="head"><span class="who"></span><span class="status"></span>' +
        '<span class="t"></span></div><div class="text"></div><div class="detail"></div>';
      el.querySelector(".who").textContent = u.role === "user" ? "TY" : "CLAUDE";
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
    if (u.text) { txt.textContent = u.text; txt.className = "text"; }
    else {
      txt.className = "text pending";
      txt.textContent = phase === "rec" ? "słucham, mów dalej…" :
                        phase === "work" ? "za chwilę pojawi się tekst…" : "—";
    }
    el.querySelector(".detail").textContent = u.detail || "";
  }

  function setState(cls, label) {
    const chip = document.getElementById("state");
    chip.className = "chip " + cls;
    document.getElementById("state-label").textContent = label;
  }

  async function tick() {
    try {
      const s = await (await fetch("/status")).json();
      document.getElementById("queued").textContent = s.queued;
      if (!s.listening) setState("muted", "wyciszony — Claude mówi");
      else if (s.recording) setState("recording", "nagrywam twoją wypowiedź");
      else setState("listening", "słucham");
      const data = await (await fetch("/utterances")).json();
      for (const u of data.utterances) upsert(u);
    } catch {
      setState("offline", "demon nie odpowiada");
    }
  }
  tick();
  setInterval(tick, 400);
</script>
</body>
</html>
"""
