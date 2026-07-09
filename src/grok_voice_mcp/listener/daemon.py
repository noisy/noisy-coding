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

from grok_voice_mcp.listener import pricing, stt, stt_stream
import json

from grok_voice_mcp.listener.http_api import (
    CHARACTER_FILE,
    DEFAULT_PORT,
    PORT_ENV_VAR,
    SETTINGS_FILE,
    start_http_api,
)
from grok_voice_mcp.listener.state import ListenerState
from grok_voice_mcp.listener.vad import UtteranceSegmenter, VadConfig

STT_LANGUAGE_ENV_VAR = "GROK_VOICE_STT_LANGUAGE"
MODE_ENV_VAR = "GROK_VOICE_MODE"
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


def _start_stream(
    segmenter, config: VadConfig, language: str, state: ListenerState, utterance_id: int
) -> stt_stream.StreamingSession | None:
    longest_shown = 0

    def on_partial(text: str) -> None:
        # Server-side revisions can briefly shrink the text; never show that.
        nonlocal longest_shown
        if len(text) < longest_shown:
            return
        longest_shown = len(text)
        state.update_utterance(utterance_id, text=text, status="transcribing (live)…")

    smart_turn = state.smart_turn

    def on_turn_end() -> None:
        # smart_turn judged the thought complete: close the utterance now
        # instead of waiting for the VAD silence timer.
        segmenter.request_close()

    try:
        session = stt_stream.StreamingSession(
            config.sample_rate,
            language,
            on_partial,
            smart_turn=smart_turn,
            on_turn_end=on_turn_end if smart_turn > 0 else None,
        )
    except stt_stream.GrokStreamError as error:
        _log(f"[stream-error] {error} — falling back to batch for this utterance")
        return None
    for frame in segmenter.recording_frames:
        session.send(frame.tobytes())
    return session


def _finalize_stream(
    session: stt_stream.StreamingSession,
    seconds: float,
    state: ListenerState,
    utterance_id: int,
) -> None:
    cost = pricing.stt_streaming_cost_usd(seconds)
    state.add_cost("user", cost)
    state.update_utterance(
        utterance_id, detail=f"{seconds:.1f}s audio · live", cost_usd=cost
    )
    text = session.finish()
    if not text:
        _log(f"[dropped] {seconds:.1f}s live stream transcribed to nothing")
        state.update_utterance(utterance_id, status="empty — no speech")
        return
    state.add_transcript(text, utterance_id)
    _log(f"[queued/live] ({seconds:.1f}s) {text}")


def run(config: VadConfig | None = None) -> None:
    config = config or VadConfig()
    language = os.environ.get(STT_LANGUAGE_ENV_VAR, "")
    port = int(os.environ.get(PORT_ENV_VAR, str(DEFAULT_PORT)))

    state = ListenerState()
    state.set_mode(os.environ.get(MODE_ENV_VAR, "batch"))
    try:
        state.set_character(json.loads(CHARACTER_FILE.read_text()))
    except (OSError, ValueError):
        pass
    # Saved tuning (pause-split, smart_turn, mode) survives restarts and
    # overrides the env default for mode, since it reflects newer intent.
    try:
        saved = json.loads(SETTINGS_FILE.read_text())
        if "end_silence_ms" in saved:
            state.set_end_silence_ms(saved["end_silence_ms"])
        if "smart_turn" in saved:
            state.set_smart_turn(saved["smart_turn"])
        if saved.get("mode") in ("batch", "live"):
            state.set_mode(saved["mode"])
        if saved.get("tts_mode") in ("batch", "live"):
            state.set_tts_mode(saved["tts_mode"])
        if saved.get("smart_turn_mode") in ("soft", "hard"):
            state.set_smart_turn_mode(saved["smart_turn_mode"])
    except (OSError, ValueError):
        pass
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
            stream: stt_stream.StreamingSession | None = None
            while True:
                frame = frames.get()
                if state.paused:
                    continue
                segmenter.end_silence_ms_override = state.end_silence_ms
                segmenter.smart_turn_mode = state.smart_turn_mode
                was_recording = segmenter.is_recording
                utterance = segmenter.feed(frame)
                state.set_recording(segmenter.is_recording)
                if segmenter.is_recording and not was_recording:
                    state.add_event("recording")
                    current_utterance_id = state.create_utterance("user", "recording…")
                    if state.mode == "live":
                        stream = _start_stream(
                            segmenter, config, language, state, current_utterance_id
                        )
                elif segmenter.is_recording and stream is not None:
                    stream.send(frame.tobytes())
                elif was_recording and not segmenter.is_recording:
                    state.add_event("recording_done", "0.8s of silence — closing utterance")
                    if utterance is None:
                        if stream is not None:
                            # A short clip may still hold real words — let the
                            # stream finalize; only truly empty ones are dropped.
                            stt_executor.submit(
                                _finalize_stream,
                                stream,
                                config.min_utterance_ms / 1000,
                                state,
                                current_utterance_id,
                            )
                            stream = None
                        else:
                            state.update_utterance(
                                current_utterance_id, status="dropped — too short"
                            )
                if utterance is not None:
                    seconds = len(utterance) / config.sample_rate
                    if stream is not None:
                        stt_executor.submit(
                            _finalize_stream, stream, seconds, state, current_utterance_id
                        )
                        stream = None
                    else:
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
