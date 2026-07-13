"""Always-on listener daemon: mic -> VAD -> Grok STT -> localhost queue.

Run with: grok-voice-listener
The Claude Code hooks poll GET /drain on the HTTP API to pick up transcripts.
"""

import os
import queue
import sys
import threading
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import httpx
import numpy as np
import sounddevice as sd

from grok_voice_mcp import credentials
from grok_voice_mcp.listener import pricing, speech, stt, stt_stream
import json

from grok_voice_mcp.listener.http_api import (
    CHARACTER_FILE,
    DEFAULT_PORT,
    PORT_ENV_VAR,
    SETTINGS_FILE,
    start_http_api,
)
from grok_voice_mcp.listener.state import ListenerState
from grok_voice_mcp.listener.tab_audio import start_bridge
from grok_voice_mcp.listener.vad import UtteranceSegmenter, VadConfig

STT_LANGUAGE_ENV_VAR = "GROK_VOICE_STT_LANGUAGE"
MODE_ENV_VAR = "GROK_VOICE_MODE"
MANAGEMENT_KEY_ENV_VAR = "GROK_VOICE_MANAGEMENT_KEY"
TEAM_ID_ENV_VAR = "GROK_VOICE_TEAM_ID"
CREDITS_POLL_SECONDS = 60.0
# Display gain for the dashboard mic level: int16 speech RMS is small
# (~0.02-0.08 full-scale), this maps it into a readable 0..1 range.
MIC_LEVEL_GAIN = 12.0
# While the push-to-talk lease is held, silence must never close the
# utterance — the button release is the only end-of-turn signal.
PTT_NEVER_CLOSE_MS = 10**9
# How often the audio loop re-reads whether an API key exists (a file
# check 30×/s would be waste; a freshly pasted key goes live within this).
API_KEY_CHECK_SECONDS = 2.0
# A healthy mic feeds the callback ~30 frames/s; a multi-second starvation
# means the machine slept or the device vanished — after either, a
# long-lived PortAudio stream can come back degraded (wrong device /
# resampling), which garbles STT. Reopen instead of trusting it.
AUDIO_GAP_REOPEN_SECONDS = 5.0
# And when the stream dies OUTRIGHT (device disappears mid-utterance),
# frames stop arriving at all — the loop must not block forever waiting
# for one, or `recording` wedges True and the speech gate never releases.
FRAME_WAIT_SECONDS = 2.0
# Conversation history persistence: the log used to live only in memory,
# so every daemon restart wiped the conversation from the dashboard.
HISTORY_FILE = Path.home() / ".config" / "grok-voice" / "history.json"
HISTORY_SAVE_SECONDS = 5.0


def _load_history(state: ListenerState) -> None:
    try:
        items = json.loads(HISTORY_FILE.read_text())
        if isinstance(items, list):
            state.load_utterances(items)
    except (OSError, ValueError):
        pass


def _save_history(state: ListenerState) -> None:
    try:
        HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        HISTORY_FILE.write_text(json.dumps(state.snapshot_utterances()))
    except OSError:
        pass


def _history_saver(state: ListenerState) -> None:
    last_saved = ""
    while True:
        threading.Event().wait(HISTORY_SAVE_SECONDS)
        snapshot = json.dumps(state.snapshot_utterances())
        if snapshot != last_saved:
            _save_history(state)
            last_saved = snapshot


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
    state: ListenerState,
    utterance_id: int,
) -> None:
    seconds = len(samples) / sample_rate
    cost = pricing.stt_cost_usd(seconds)
    state.add_cost("user", cost)
    state.add_usage("stt_seconds", seconds)
    _log(f"[transcribing] {seconds:.1f}s of audio (batch)")
    state.add_event("transcribing", f"{seconds:.1f}s")
    state.update_utterance(
        utterance_id,
        status="transcribing (Grok STT)…",
        detail=f"{seconds:.1f}s audio",
        cost_usd=cost,
        duration_s=round(seconds, 1),
    )
    stt_started = time.monotonic()
    try:
        text = stt.transcribe(stt.encode_wav(samples, sample_rate), state.language)
        state.set_latency("stt", (time.monotonic() - stt_started) * 1000)
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
    segmenter, config: VadConfig, state: ListenerState, utterance_id: int
) -> stt_stream.StreamingSession | None:
    longest_shown = 0
    language = state.language

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
    state.add_usage("stt_seconds", seconds)
    state.update_utterance(
        utterance_id,
        detail=f"{seconds:.1f}s audio · live",
        cost_usd=cost,
        duration_s=round(seconds, 1),
    )
    finish_started = time.monotonic()
    text = session.finish()
    state.set_latency("stt", (time.monotonic() - finish_started) * 1000)
    if not text:
        _log(f"[dropped] {seconds:.1f}s live stream transcribed to nothing")
        state.update_utterance(utterance_id, status="empty — no speech")
        return
    state.add_transcript(text, utterance_id)
    _log(f"[queued/live] ({seconds:.1f}s) {text}")


def _open_input_stream(state: ListenerState, config: VadConfig, on_audio) -> sd.InputStream:
    """Open the selected microphone, falling back to the system default.

    The user's pick may vanish (unplugged headphones) — revert to the
    default instead of dying; only a failure of the default propagates.
    """
    selected = state.input_device
    options = {"device": selected} if selected else {}
    try:
        input_stream = sd.InputStream(
            samplerate=config.sample_rate,
            channels=1,
            dtype="int16",
            blocksize=config.frame_samples,
            callback=on_audio,
            **options,
        )
    except (sd.PortAudioError, ValueError) as error:
        if not selected:
            raise
        _log(f"[mic] cannot open '{selected}': {error} — reverting to system default")
        state.add_event("mic_error", f"cannot open '{selected}' — reverted to system default")
        state.set_input_device("")
        return _open_input_stream(state, config, on_audio)
    input_stream.start()
    _log(f"[mic] listening on {selected or 'system default'}")
    # An inline system row in the conversation timeline: seeing "mic →
    # Jabra" right above three garbled messages explains them instantly,
    # without raising any alarm when nothing is actually wrong.
    state.create_utterance(
        "system", "", text=f"MIC → {selected or 'system default'}"
    )
    return input_stream


def run(config: VadConfig | None = None) -> None:
    config = config or VadConfig()
    port = int(os.environ.get(PORT_ENV_VAR, str(DEFAULT_PORT)))

    state = ListenerState()
    state.set_mode(os.environ.get(MODE_ENV_VAR, "batch"))
    state.set_language(os.environ.get(STT_LANGUAGE_ENV_VAR, ""))
    try:
        saved_chars = json.loads(CHARACTER_FILE.read_text())
        # New format: {agent: character}. Old format: a single character dict.
        if saved_chars and all(isinstance(v, dict) for v in saved_chars.values()):
            for agent_key, char in saved_chars.items():
                state.set_character(char, agent_key)
        else:
            state.set_character(saved_chars)
    except (OSError, ValueError, AttributeError):
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
        if saved.get("detection_mode") in ("auto", "ptt"):
            state.set_detection_mode(saved["detection_mode"])
        if "input_device" in saved:
            state.set_input_device(str(saved["input_device"]))
        if "language" in saved:
            state.set_language(saved["language"])
    except (OSError, ValueError):
        pass
    _load_history(state)
    threading.Thread(target=_history_saver, args=(state,), daemon=True).start()
    server = start_http_api(state, port)
    if os.environ.get(MANAGEMENT_KEY_ENV_VAR) and os.environ.get(TEAM_ID_ENV_VAR):
        threading.Thread(target=_poll_credits, args=(state,), daemon=True).start()
    segmenter = UtteranceSegmenter(config)
    frames: queue.Queue[np.ndarray] = queue.Queue()
    stt_executor = ThreadPoolExecutor(max_workers=1)
    # Browser-tab audio: a WS bridge one port up feeds the SAME frames
    # queue, so downstream (VAD/STT/PTT) can't tell tab from hardware.
    start_bridge(state, frames, config.frame_samples, port)

    def on_audio(indata: np.ndarray, *_args: object) -> None:
        frames.put(indata[:, 0].copy())

    _log(f"grok-voice-listener: mic on, API at http://127.0.0.1:{port}")
    _log("Endpoints: GET /drain /status, POST /speak /pause /resume. Ctrl+C to stop.")

    active_input = _open_input_stream(state, config, on_audio)
    active_device = state.input_device
    try:
        try:
            current_utterance_id = 0
            stream: stt_stream.StreamingSession | None = None
            api_key_present = False
            key_check_at = 0.0
            last_frame_at = time.monotonic()

            def reopen_input(reason: str, kind: str = "mic") -> None:
                nonlocal active_input, active_device, segmenter, stream, last_frame_at
                _log(f"[mic] {reason} — reopening input stream")
                state.add_event(kind, f"input reopened: {reason}")
                # New stream = new acoustics: the adaptive noise floor
                # calibrated on the old device is void — a dead device's
                # digital silence anchors it near zero, after which every
                # ambient sound reads as speech and the utterance never
                # closes. Fresh segmenter; a half-recorded utterance is
                # closed out honestly.
                if segmenter.is_recording:
                    state.update_utterance(
                        current_utterance_id, status="dropped — mic changed"
                    )
                if stream is not None:
                    stream.abort()
                    stream = None
                segmenter = UtteranceSegmenter(config)
                state.set_recording(False)
                active_input.stop()
                active_input.close()
                active_input = _open_input_stream(state, config, on_audio)
                active_device = state.input_device
                last_frame_at = time.monotonic()

            while True:
                try:
                    frame = frames.get(timeout=FRAME_WAIT_SECONDS)
                except queue.Empty:
                    reopen_input("no audio frames (stream stalled)", kind="mic_error")
                    continue
                now = time.monotonic()
                frame_gap = now - last_frame_at
                last_frame_at = now
                if state.input_device != active_device or frame_gap > AUDIO_GAP_REOPEN_SECONDS:
                    reopen_input(
                        f"{frame_gap:.0f}s audio gap (sleep/device change?)"
                        if frame_gap > AUDIO_GAP_REOPEN_SECONDS
                        else "microphone switched"
                    )
                    continue  # this frame may still be the old stream's
                if now >= key_check_at:
                    api_key_present = bool(credentials.api_key())
                    key_check_at = now + API_KEY_CHECK_SECONDS
                if state.paused:
                    # A muted mic isn't listening — the oscilloscope must
                    # flatline instead of showing our own playback echo.
                    state.set_mic_level(0.0)
                    # A muted mic must not stay recording either: paused
                    # frames never reach the segmenter, so an utterance
                    # open at mute time would freeze in "transcribing…"
                    # until unmute. Mute is the hardest end-of-turn signal
                    # there is — close the segment NOW with the audio it
                    # already holds. Only for the user's explicit mute:
                    # the transient echo-pause during playback must not
                    # cut a PTT barge-in recording short.
                    if segmenter.is_recording and state.user_muted:
                        utterance = segmenter.flush()
                        state.set_recording(False)
                        _log("[recording] closed by mic mute")
                        state.add_event("recording_done", "closed by mic mute")
                        if stream is not None:
                            seconds = (
                                len(utterance) / config.sample_rate
                                if utterance is not None
                                else config.min_utterance_ms / 1000
                            )
                            stt_executor.submit(
                                _finalize_stream, stream, seconds, state, current_utterance_id
                            )
                            stream = None
                        elif utterance is not None:
                            stt_executor.submit(
                                _transcribe_and_enqueue,
                                utterance,
                                config.sample_rate,
                                state,
                                current_utterance_id,
                            )
                        else:
                            state.update_utterance(
                                current_utterance_id, status="dropped — too short"
                            )
                    continue
                # Live level for the dashboard oscilloscope: frame RMS in
                # 0..1, scaled so normal speech lands around 0.2-0.8.
                rms = float(np.sqrt(np.mean((frame / 32768.0) ** 2)))
                state.set_mic_level(min(1.0, rms * MIC_LEVEL_GAIN))
                # No API key = no capture: the scopes stay alive (local mic
                # level), but nothing gets segmented — no doomed bubbles
                # stuck in "transcribing" during first contact.
                if not api_key_present:
                    state.set_recording(False)
                    continue
                # Push-to-talk: the held button IS the turn signal. Idle =
                # cold mic (nothing captured); held = the utterance never
                # closes on silence; release = close it right now.
                ptt = state.detection_mode == "ptt"
                ptt_held = ptt and state.ptt_held
                if ptt and not ptt_held and not segmenter.is_recording:
                    state.set_recording(False)
                    continue
                if ptt_held:
                    segmenter.end_silence_ms_override = PTT_NEVER_CLOSE_MS
                else:
                    segmenter.end_silence_ms_override = state.end_silence_ms
                    if ptt and segmenter.is_recording:
                        segmenter.request_close()
                segmenter.smart_turn_mode = state.smart_turn_mode
                was_recording = segmenter.is_recording
                utterance = segmenter.feed(frame)
                state.set_recording(segmenter.is_recording)
                if segmenter.is_recording and not was_recording:
                    _log("[recording] user started speaking")
                    state.add_event("recording")
                    current_utterance_id = state.create_utterance("user", "recording…")
                    if state.mode == "live":
                        stream = _start_stream(
                            segmenter, config, state, current_utterance_id
                        )
                elif segmenter.is_recording and stream is not None:
                    stream.send(frame.tobytes())
                elif was_recording and not segmenter.is_recording:
                    silence_note = (
                        f"{state.end_silence_ms / 1000:.1f}s of silence — closing utterance"
                    )
                    _log(f"[recording] done — {silence_note}")
                    state.add_event("recording_done", silence_note)
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
                            state,
                            current_utterance_id,
                        )
        except KeyboardInterrupt:
            _log("\ngrok-voice-listener: stopping")
        finally:
            _save_history(state)
            server.shutdown()
            stt_executor.shutdown(wait=False)
            speech.shutdown()
    finally:
        active_input.stop()
        active_input.close()


def main() -> None:
    try:
        run()
    except sd.PortAudioError as error:
        print(f"Cannot open microphone: {error}", file=sys.stderr)
        print(
            "Hint: no audio device/server reachable. In Docker on Linux, pass the "
            "host's PulseAudio socket:\n"
            "  -v $XDG_RUNTIME_DIR/pulse/native:/run/pulse/native "
            "-e PULSE_SERVER=unix:/run/pulse/native\n"
            "(see docker-compose.yml in the repo).",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
