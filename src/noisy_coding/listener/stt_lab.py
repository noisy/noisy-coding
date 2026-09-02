"""STT Lab - one-button consistency sweep, served by the daemon (day 4).

Same-sounding phrases kept transcribing differently; the daemon now archives
every utterance's WAV (utterance_audio/). This page has ONE job: a RERUN
button that replays the newest recordings through the active engine - same
bytes, batch and live paths - and shows a short per-file summary plus a
verdict. Deliberately simple: no per-test knobs, the CLI harness
(tools/stt_consistency.py) exists for deep dives.

Endpoint (wired in http_api.py):
    POST /stt-lab/run    run the sweep -> summary JSON
The PAGE lives in the dashboard (SttLabView.vue) - the daemon serves data,
never markup.
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

