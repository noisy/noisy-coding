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
  main { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 1.3rem; letter-spacing: -0.01em; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 0.85rem; margin: 0 0 20px; }

  .statusbar {
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    margin-bottom: 22px;
  }
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
  @media (prefers-reduced-motion: reduce) { .dot { animation: none !important; } }

  .rules {
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
    padding: 14px 18px; margin-bottom: 22px; font-size: 0.85rem;
  }
  .rules h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); margin: 0 0 10px; }
  .rules table { border-collapse: collapse; width: 100%; }
  .rules td { padding: 4px 12px 4px 0; vertical-align: top; }
  .rules td:first-child {
    font-family: ui-monospace, Menlo, monospace; font-weight: 600;
    white-space: nowrap; color: var(--amber);
  }
  .rules td:last-child { color: var(--muted); }

  #feed { list-style: none; margin: 0; padding: 0; }
  #feed li {
    display: grid; grid-template-columns: 62px 118px 1fr; gap: 12px;
    padding: 9px 4px; border-bottom: 1px solid var(--line);
    font-size: 0.9rem; align-items: baseline;
  }
  #feed .t { font-family: ui-monospace, Menlo, monospace; font-size: 0.74rem; color: var(--muted); }
  #feed .k {
    font-family: ui-monospace, Menlo, monospace; font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.04em; padding: 2px 9px; border-radius: 999px;
    justify-self: start; white-space: nowrap;
  }
  .k.transcript { background: var(--amber-soft); color: var(--amber); }
  .k.recording, .k.recording_done, .k.transcribing { background: var(--code-bg); color: var(--muted); }
  .k.delivered { background: var(--teal-soft); color: var(--teal); }
  .k.speak, .k.speak_audio, .k.speak_done { background: var(--violet-soft); color: var(--violet); }
  .k.dropped, .k.stt_error { background: var(--red-soft); color: var(--red); }
  .k.muted, .k.unmuted { background: var(--code-bg); color: var(--muted); }
  #feed .d { overflow-wrap: anywhere; }
  #feed .d.q { font-style: italic; }
  .empty { color: var(--muted); font-size: 0.9rem; padding: 24px 4px; }
</style>
</head>
<body>
<main>
  <h1>grok-voice — podgląd na żywo</h1>
  <p class="sub">Mikrofon → VAD → Grok STT → kolejka → Claude · odświeżanie co 500 ms</p>

  <div class="statusbar">
    <span class="chip" id="state"><span class="dot"></span><span id="state-label">łączenie…</span></span>
    <span class="chip"><span id="queued">0</span>&nbsp;w kolejce</span>
  </div>

  <div class="rules">
    <h2>Reguły czasowe</h2>
    <table>
      <tr><td>&lt; 0,8 s</td><td>pauza w mówieniu — nic się nie dzieje, to wciąż jedna wypowiedź</td></tr>
      <tr><td>0,8 s ciszy</td><td>VAD zamyka fragment i wysyła go do transkrypcji (~1 s)</td></tr>
      <tr><td>2 s ciszy</td><td>po transkrypcie: koniec „grace period” — Claude zostaje obudzony z całością; jeśli w tym czasie znów mówisz, czekanie trwa dalej (maks. 20 s)</td></tr>
      <tr><td>5 min</td><td>tyle po zakończeniu tury hook czuwa w tle na twój głos</td></tr>
    </table>
  </div>

  <ul id="feed"><li class="empty" id="empty">Czekam na pierwsze zdarzenia…</li></ul>
</main>
<script>
  const LABELS = {
    transcript:   ["TRANSKRYPT", t => "„" + t + "”"],
    delivered:    ["→ CLAUDE", t => "Claude odebrał: „" + t + "”"],
    recording:    ["NAGRYWAM", () => "wykryto mowę — zbieram wypowiedź"],
    recording_done:["KONIEC MOWY", t => t],
    transcribing: ["STT…", t => "wysłano " + t + " audio do transkrypcji"],
    dropped:      ["PUSTE", t => t],
    stt_error:    ["BŁĄD STT", t => t],
    speak:        ["CLAUDE MÓWI", t => t],
    speak_audio:  ["MP3 GOTOWE", t => t],
    speak_done:   ["ODTWORZONO", t => t],
    muted:        ["WYCISZONY", () => "nasłuch zapauzowany (Claude mówi)"],
    unmuted:      ["SŁUCHAM", () => "nasłuch wznowiony"],
  };
  let since = 0;
  const feed = document.getElementById("feed");

  function fmtTime(ts) {
    return new Date(ts * 1000).toLocaleTimeString("pl-PL");
  }
  function render(ev) {
    document.getElementById("empty")?.remove();
    const [label, fmt] = LABELS[ev.kind] || [ev.kind.toUpperCase(), t => t];
    const li = document.createElement("li");
    const quote = ev.kind === "transcript" || ev.kind === "delivered";
    li.innerHTML =
      '<span class="t">' + fmtTime(ev.ts) + '</span>' +
      '<span class="k ' + ev.kind + '">' + label + '</span>' +
      '<span class="d' + (quote ? " q" : "") + '"></span>';
    li.querySelector(".d").textContent = fmt(ev.detail);
    feed.prepend(li);
    while (feed.children.length > 200) feed.lastChild.remove();
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
      const e = await (await fetch("/events?since=" + since)).json();
      for (const ev of e.events) { render(ev); since = ev.seq; }
    } catch {
      setState("offline", "demon nie odpowiada");
    }
  }
  tick();
  setInterval(tick, 500);
</script>
</body>
</html>
"""
