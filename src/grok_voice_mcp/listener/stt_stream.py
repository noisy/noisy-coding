"""Per-utterance streaming transcription over the Grok STT websocket.

One session per utterance: opened when VAD detects speech, fed raw PCM
frames while the user talks, closed with audio.done when VAD closes.
Partial transcripts arrive during speech via the on_partial callback.
"""

import json
import threading
from collections.abc import Callable

from websockets.sync.client import connect

from grok_voice_mcp import tts

STREAM_URL_BASE = "wss://api.x.ai/v1/stt"
CONNECT_TIMEOUT_SECONDS = 5.0
FINISH_TIMEOUT_SECONDS = 10.0


class GrokStreamError(RuntimeError):
    """Raised when the streaming STT session cannot be established."""


def _extract_text(payload: dict) -> str:
    for key in ("text", "transcript"):
        if isinstance(payload.get(key), str):
            return payload[key]
    return ""


class StreamingSession:
    """A live websocket transcription of a single utterance."""

    def __init__(
        self,
        sample_rate: int,
        language: str,
        on_partial: Callable[[str], None],
    ) -> None:
        query = f"sample_rate={sample_rate}&encoding=pcm&interim_results=true"
        if language:
            query += f"&language={language}"
        try:
            self._ws = connect(
                f"{STREAM_URL_BASE}?{query}",
                additional_headers={"Authorization": f"Bearer {tts._api_key()}"},
                open_timeout=CONNECT_TIMEOUT_SECONDS,
            )
        except Exception as error:
            raise GrokStreamError(f"Cannot open streaming STT session: {error}") from error

        self._on_partial = on_partial
        self._segments: list[str] = []
        self._current_segment = ""
        self._done = threading.Event()
        threading.Thread(target=self._read_loop, daemon=True).start()

    def _full_text(self) -> str:
        parts = self._segments + ([self._current_segment] if self._current_segment else [])
        return " ".join(parts)

    def send(self, pcm_bytes: bytes) -> None:
        try:
            self._ws.send(pcm_bytes)
        except Exception:
            self._done.set()

    def _read_loop(self) -> None:
        try:
            for message in self._ws:
                if isinstance(message, bytes):
                    continue
                payload = json.loads(message)
                kind = payload.get("type", "")
                if kind == "transcript.partial":
                    text = _extract_text(payload)
                    if payload.get("speech_final"):
                        # Segment closed: bank its final text and start fresh.
                        if text:
                            self._segments.append(text)
                        self._current_segment = ""
                    elif text:
                        self._current_segment = text
                    if text:
                        self._on_partial(self._full_text())
                elif kind == "transcript.done":
                    # done carries no text; the banked segments are the answer.
                    done_text = _extract_text(payload)
                    if done_text and len(done_text) > len(self._full_text()):
                        self._segments = [done_text]
                        self._current_segment = ""
                    self._done.set()
                    return
                elif kind == "error":
                    self._done.set()
                    return
        except Exception:
            pass
        self._done.set()

    def finish(self) -> str:
        """Signal end of audio and wait for the final transcript."""
        try:
            self._ws.send(json.dumps({"type": "audio.done"}))
        except Exception:
            pass
        self._done.wait(FINISH_TIMEOUT_SECONDS)
        try:
            self._ws.close()
        except Exception:
            pass
        return self._full_text().strip()

    def abort(self) -> None:
        try:
            self._ws.close()
        except Exception:
            pass
