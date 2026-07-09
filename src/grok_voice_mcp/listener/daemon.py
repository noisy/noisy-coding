"""Always-on listener daemon: mic -> VAD -> Grok STT -> localhost queue.

Run with: grok-voice-listener
The Claude Code hooks poll GET /drain on the HTTP API to pick up transcripts.
"""

import os
import queue
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import sounddevice as sd

from grok_voice_mcp.listener import stt
from grok_voice_mcp.listener.http_api import DEFAULT_PORT, PORT_ENV_VAR, start_http_api
from grok_voice_mcp.listener.state import ListenerState
from grok_voice_mcp.listener.vad import UtteranceSegmenter, VadConfig

STT_LANGUAGE_ENV_VAR = "GROK_VOICE_STT_LANGUAGE"


def _log(message: str) -> None:
    print(message, flush=True)


def _transcribe_and_enqueue(
    samples: np.ndarray, sample_rate: int, language: str, state: ListenerState
) -> None:
    seconds = len(samples) / sample_rate
    try:
        text = stt.transcribe(stt.encode_wav(samples, sample_rate), language)
    except stt.GrokSTTError as error:
        _log(f"[stt-error] {error}")
        return
    if not text:
        _log(f"[dropped] {seconds:.1f}s of audio transcribed to nothing")
        return
    state.add_transcript(text)
    _log(f"[queued] ({seconds:.1f}s) {text}")


def run(config: VadConfig | None = None) -> None:
    config = config or VadConfig()
    language = os.environ.get(STT_LANGUAGE_ENV_VAR, "")
    port = int(os.environ.get(PORT_ENV_VAR, str(DEFAULT_PORT)))

    state = ListenerState()
    server = start_http_api(state, port)
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
            while True:
                frame = frames.get()
                if state.paused:
                    continue
                utterance = segmenter.feed(frame)
                state.set_recording(segmenter.is_recording)
                if utterance is not None:
                    stt_executor.submit(
                        _transcribe_and_enqueue,
                        utterance,
                        config.sample_rate,
                        language,
                        state,
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
