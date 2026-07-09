"""Always-on listener daemon: mic -> VAD -> Grok STT -> localhost queue.

Run with: grok-voice-listener
The Claude Code hooks poll GET /drain on the HTTP API to pick up transcripts.
"""

import os
import queue
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

import httpx
import numpy as np
import sounddevice as sd

from grok_voice_mcp.listener import pricing, stt
from grok_voice_mcp.listener.http_api import DEFAULT_PORT, PORT_ENV_VAR, start_http_api
from grok_voice_mcp.listener.state import ListenerState
from grok_voice_mcp.listener.vad import UtteranceSegmenter, VadConfig

STT_LANGUAGE_ENV_VAR = "GROK_VOICE_STT_LANGUAGE"
MANAGEMENT_KEY_ENV_VAR = "GROK_VOICE_MANAGEMENT_KEY"
TEAM_ID_ENV_VAR = "GROK_VOICE_TEAM_ID"
CREDITS_POLL_SECONDS = 60.0


def _poll_credits(state: ListenerState) -> None:
    """Refresh the team's remaining prepaid credits once a minute."""
    management_key = os.environ[MANAGEMENT_KEY_ENV_VAR]
    team_id = os.environ[TEAM_ID_ENV_VAR]
    url = f"https://management-api.x.ai/v1/billing/teams/{team_id}/prepaid/balance"
    while True:
        try:
            response = httpx.get(
                url, headers={"Authorization": f"Bearer {management_key}"}, timeout=10
            )
            if response.status_code == httpx.codes.OK:
                cents = float(response.json().get("total", {}).get("val", 0))
                state.set_credits_usd(abs(cents) / 100)
        except (httpx.HTTPError, ValueError):
            pass
        threading.Event().wait(CREDITS_POLL_SECONDS)


def _log(message: str) -> None:
    print(message, flush=True)


def _transcribe_and_enqueue(
    samples: np.ndarray,
    sample_rate: int,
    language: str,
    state: ListenerState,
    utterance_id: int,
) -> None:
    seconds = len(samples) / sample_rate
    cost = pricing.stt_cost_usd(seconds)
    state.add_cost("user", cost)
    state.add_event("transcribing", f"{seconds:.1f}s")
    state.update_utterance(
        utterance_id,
        status="transcribing (Grok STT)…",
        detail=f"{seconds:.1f}s audio",
        cost_usd=cost,
    )
    try:
        text = stt.transcribe(stt.encode_wav(samples, sample_rate), language)
    except stt.GrokSTTError as error:
        _log(f"[stt-error] {error}")
        state.add_event("stt_error", str(error)[:200])
        state.update_utterance(utterance_id, status="transcription error")
        return
    if not text:
        _log(f"[dropped] {seconds:.1f}s of audio transcribed to nothing")
        state.add_event("dropped", f"{seconds:.1f}s of audio, no speech")
        state.update_utterance(utterance_id, status="empty — no speech")
        return
    state.add_transcript(text, utterance_id)
    _log(f"[queued] ({seconds:.1f}s) {text}")


def run(config: VadConfig | None = None) -> None:
    config = config or VadConfig()
    language = os.environ.get(STT_LANGUAGE_ENV_VAR, "")
    port = int(os.environ.get(PORT_ENV_VAR, str(DEFAULT_PORT)))

    state = ListenerState()
    server = start_http_api(state, port)
    if os.environ.get(MANAGEMENT_KEY_ENV_VAR) and os.environ.get(TEAM_ID_ENV_VAR):
        threading.Thread(target=_poll_credits, args=(state,), daemon=True).start()
    segmenter = UtteranceSegmenter(config)
    frames: queue.Queue[np.ndarray] = queue.Queue()
    stt_executor = ThreadPoolExecutor(max_workers=1)

    def on_audio(indata: np.ndarray, *_args: object) -> None:
        frames.put(indata[:, 0].copy())

    _log(f"grok-voice-listener: mic on, API at http://127.0.0.1:{port}")
    _log("Endpoints: GET /drain /status, POST /pause /resume. Ctrl+C to stop.")

    with sd.InputStream(
        samplerate=config.sample_rate,
        channels=1,
        dtype="int16",
        blocksize=config.frame_samples,
        callback=on_audio,
    ):
        try:
            current_utterance_id = 0
            while True:
                frame = frames.get()
                if state.paused:
                    continue
                was_recording = segmenter.is_recording
                utterance = segmenter.feed(frame)
                state.set_recording(segmenter.is_recording)
                if segmenter.is_recording and not was_recording:
                    state.add_event("recording")
                    current_utterance_id = state.create_utterance("user", "recording…")
                elif was_recording and not segmenter.is_recording:
                    state.add_event("recording_done", "0.8s of silence — closing utterance")
                    if utterance is None:
                        state.update_utterance(
                            current_utterance_id, status="dropped — too short"
                        )
                if utterance is not None:
                    stt_executor.submit(
                        _transcribe_and_enqueue,
                        utterance,
                        config.sample_rate,
                        language,
                        state,
                        current_utterance_id,
                    )
        except KeyboardInterrupt:
            _log("\ngrok-voice-listener: stopping")
        finally:
            server.shutdown()
            stt_executor.shutdown(wait=False)


def main() -> None:
    try:
        run()
    except sd.PortAudioError as error:
        print(f"Cannot open microphone: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
