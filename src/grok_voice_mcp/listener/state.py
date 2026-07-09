"""Shared, thread-safe state between the audio loop and the HTTP API."""

import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class Transcript:
    text: str
    timestamp: float


class ListenerState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._transcripts: list[Transcript] = []
        self._paused = False
        self._recording = False
        self._last_transcript_at = 0.0

    def add_transcript(self, text: str) -> None:
        with self._lock:
            now = time.time()
            self._transcripts.append(Transcript(text=text, timestamp=now))
            self._last_transcript_at = now

    def drain(self) -> list[Transcript]:
        with self._lock:
            transcripts, self._transcripts = self._transcripts, []
            return transcripts

    @property
    def queued_count(self) -> int:
        with self._lock:
            return len(self._transcripts)

    @property
    def last_transcript_at(self) -> float:
        with self._lock:
            return self._last_transcript_at

    @property
    def recording(self) -> bool:
        with self._lock:
            return self._recording

    def set_recording(self, recording: bool) -> None:
        with self._lock:
            self._recording = recording

    @property
    def paused(self) -> bool:
        with self._lock:
            return self._paused

    def set_paused(self, paused: bool) -> None:
        with self._lock:
            self._paused = paused
