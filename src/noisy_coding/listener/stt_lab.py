"""STT Lab - one-button consistency sweep, served by the daemon (day 4).

Same-sounding phrases kept transcribing differently; the daemon now archives
every utterance's WAV (utterance_audio/). This page has ONE job: a RERUN
button that replays the newest recordings through the active engine - same
bytes, batch and live paths - and shows a short per-file summary plus a
verdict. Deliberately simple: no per-test knobs, the CLI harness
(tools/stt_consistency.py) exists for deep dives.

Endpoints (wired in http_api.py):
    GET  /stt-lab        the page
    POST /stt-lab/run    run the sweep -> summary JSON
"""
import difflib
import itertools
import statistics
import time
import wave
from pathlib import Path

from noisy_coding import providers
from noisy_coding.config_dir import CONFIG_DIR

AUDIO_DIR = CONFIG_DIR / "utterance_audio"
SWEEP_FILES = 5
SWEEP_RUNS = 3
PASS_SCORE = 0.90


def _transcribe_live(provider, path: Path) -> str:
    with wave.open(str(path), "rb") as w:
        rate = w.getframerate()
        pcm = w.readframes(w.getnframes())
    session = provider.open_stream(rate, "", lambda text: None)
    if session is None:
        return "<no streaming path>"
    frame = int(rate * 0.03) * 2
    for i in range(0, len(pcm), frame):
        session.send(pcm[i:i + frame])
        time.sleep(0.005)
    return session.finish()


def _score(texts: list[str]) -> float:
    if len(texts) < 2:
        return 1.0
    return statistics.mean(
        difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()
        for a, b in itertools.combinations(texts, 2))


def _worst_diff(texts: list[str]) -> str:
    reference = max(set(texts), key=texts.count)
    worst, worst_ratio = "", 1.0
    for t in set(texts):
        if t == reference:
            continue
        ratio = difflib.SequenceMatcher(None, reference.lower(), t.lower()).ratio()
        if ratio < worst_ratio:
            worst_ratio = ratio
            matcher = difflib.SequenceMatcher(
                None, reference.lower().split(), t.lower().split())
            worst = " ".join(
                f"[-{' '.join(reference.split()[a1:a2])}|+{' '.join(t.split()[b1:b2])}]"
                for op, a1, a2, b1, b2 in matcher.get_opcodes() if op != "equal")
    return worst


def run_sweep() -> dict:
    files = sorted(AUDIO_DIR.glob("*.wav"), reverse=True)[:SWEEP_FILES]
    if not files:
        return {"error": "no recordings archived yet - speak to the daemon first"}
    provider = providers.active_stt()
    rows = []
    for path in files:
        wav_bytes = path.read_bytes()
        row = {"file": path.name}
        for mode in ("batch", "live"):
            texts = []
            for _ in range(SWEEP_RUNS):
                try:
                    texts.append(_transcribe_live(provider, path) if mode == "live"
                                 else provider.transcribe(wav_bytes, ""))
                except Exception as error:  # noqa: BLE001
                    texts.append(f"<ERROR: {error}>")
            row[mode] = round(_score(texts), 3)
            if row[mode] < 1.0:
                row[f"{mode}_diff"] = _worst_diff(texts)
        row["text"] = max(set(texts), key=texts.count)
        rows.append(row)
    worst = min(min(r["batch"], r["live"]) for r in rows)
    return {"engine": provider.label, "files": len(rows),
            "runs_per_path": SWEEP_RUNS, "worst": worst,
            "verdict": "PASS" if worst >= PASS_SCORE else "FAIL",
            "rows": rows}


PAGE = """<!doctype html><meta charset="utf-8">
<title>STT LAB</title>
<style>
  body { background:#050e18; color:#cfe9f5; font:13px/1.6 ui-monospace,monospace;
         max-width:860px; margin:0 auto; padding:24px; }
  h1 { font-size:16px; letter-spacing:.3em; color:#3fd8ff; }
  button { background:#071626; color:#3fd8ff; border:1px solid #1c3a52;
           font:inherit; padding:10px 26px; cursor:pointer; letter-spacing:.2em; }
  button:disabled { opacity:.4; }
  table { border-collapse:collapse; width:100%; margin-top:16px; }
  td,th { border-bottom:1px solid #12283a; padding:6px 8px; text-align:left; }
  th { color:#5b7c8f; font-weight:normal; letter-spacing:.15em; font-size:11px; }
  .ok { color:#6dff9e; } .bad { color:#ff5f6b; }
  .verdict { font-size:15px; margin-left:14px; letter-spacing:.2em; }
  .diff { color:#ffb84d; font-size:11px; }
  .txt { color:#5b7c8f; font-size:11px; }
</style>
<h1>STT LAB</h1>
<p>One sweep: the newest recordings, replayed 3x through the active engine,
batch and live. Score 1.000 = the engine is deterministic; red = it changes
its mind about identical audio.</p>
<button id="go">RERUN</button><span id="verdict" class="verdict"></span>
<div id="out"></div>
<script>
const fmt = s => `<span class="${s >= 0.90 ? 'ok' : 'bad'}">${s.toFixed(3)}</span>`;
document.getElementById('go').onclick = async () => {
  const go = document.getElementById('go');
  go.disabled = true;
  document.getElementById('verdict').textContent = 'running… ~1 min';
  let r;
  try { r = await fetch('/stt-lab/run', { method:'POST' }).then(x => x.json()); }
  catch (e) { r = { error: String(e) }; }
  go.disabled = false;
  if (r.error) { document.getElementById('verdict').textContent = r.error; return; }
  document.getElementById('verdict').innerHTML =
    `<span class="${r.verdict === 'PASS' ? 'ok' : 'bad'}">${r.verdict}</span>
     · ${r.engine} · worst ${r.worst.toFixed(3)}`;
  document.getElementById('out').innerHTML =
    '<table><tr><th>recording</th><th>batch</th><th>live</th></tr>' +
    r.rows.map(row => `<tr><td>${row.file}<div class="txt">${row.text}</div>` +
      (row.batch_diff ? `<div class="diff">${row.batch_diff}</div>` : '') +
      (row.live_diff ? `<div class="diff">${row.live_diff}</div>` : '') +
      `</td><td>${fmt(row.batch)}</td><td>${fmt(row.live)}</td></tr>`).join('') +
    '</table>';
};
</script>"""
