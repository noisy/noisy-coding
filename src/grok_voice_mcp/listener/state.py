"""Shared, thread-safe state between the audio loop and the HTTP API."""

import threading
import time
from collections import deque
from dataclasses import dataclass

EVENT_LOG_SIZE = 300
DEFAULT_CHARACTER = {"humor": 50, "honesty": 50, "brevity": 50, "chatty": 50}
DEFAULT_VOICE = "carina"
DEFAULT_SPEED = 1.0
MIN_SPEED, MAX_SPEED = 0.7, 1.5
DEFAULT_END_SILENCE_MS = 800
MIN_END_SILENCE_MS, MAX_END_SILENCE_MS = 500, 4000


@dataclass(frozen=True)
class Transcript:
    text: str
    timestamp: float
    utterance_id: int = 0


UTTERANCE_LOG_SIZE = 100


class ListenerState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._transcripts: list[Transcript] = []
        self._paused = False  # transient echo-mute while Claude speaks
        self._user_muted = False  # explicit mute from the dashboard
        self._recording = False
        self._last_transcript_at = 0.0
        self._events: deque[dict] = deque(maxlen=EVENT_LOG_SIZE)
        self._event_seq = 0
        self._utterances: deque[dict] = deque(maxlen=UTTERANCE_LOG_SIZE)
        self._utterance_seq = 0
        self._session_cost_usd = {"user": 0.0, "claude": 0.0}
        self._credits_usd: float | None = None
        self._mode = "batch"
        self._end_silence_ms = DEFAULT_END_SILENCE_MS
        self._character = dict(DEFAULT_CHARACTER) | {
            "voice": DEFAULT_VOICE,
            "speed": DEFAULT_SPEED,
        }

    @property
    def character(self) -> dict:
        with self._lock:
            return dict(self._character)

    def set_character(self, values: dict) -> dict:
        with self._lock:
            for trait in DEFAULT_CHARACTER:
                if trait in values:
                    self._character[trait] = max(0, min(100, int(values[trait])))
            voice = values.get("voice")
            if isinstance(voice, str) and voice.isalpha():
                self._character["voice"] = voice.lower()
            if "speed" in values:
                try:
                    speed = float(values["speed"])
                    self._character["speed"] = max(MIN_SPEED, min(MAX_SPEED, speed))
                except (TypeError, ValueError):
                    pass
            return dict(self._character)

    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    def set_mode(self, mode: str) -> None:
        with self._lock:
            self._mode = mode

    @property
    def end_silence_ms(self) -> int:
        with self._lock:
            return self._end_silence_ms

    def set_end_silence_ms(self, value: int) -> int:
        with self._lock:
            self._end_silence_ms = max(
                MIN_END_SILENCE_MS, min(MAX_END_SILENCE_MS, int(value))
            )
            return self._end_silence_ms

    def add_cost(self, role: str, usd: float) -> None:
        with self._lock:
            self._session_cost_usd[role] = self._session_cost_usd.get(role, 0.0) + usd

    @property
    def session_cost_usd(self) -> dict:
        with self._lock:
            return dict(self._session_cost_usd)

    @property
    def credits_usd(self) -> float | None:
        with self._lock:
            return self._credits_usd

    def set_credits_usd(self, credits: float | None) -> None:
        with self._lock:
            self._credits_usd = credits

    def add_event(self, kind: str, detail: str = "") -> None:
        with self._lock:
            self._add_event_locked(kind, detail)

    def _add_event_locked(self, kind: str, detail: str) -> None:
        self._event_seq += 1
        self._events.append(
            {"seq": self._event_seq, "ts": time.time(), "kind": kind, "detail": detail}
        )

    def events_since(self, since_seq: int) -> list[dict]:
        with self._lock:
            return [e for e in self._events if e["seq"] > since_seq]

    def create_utterance(self, role: str, status: str, text: str = "") -> int:
        with self._lock:
            self._utterance_seq += 1
            self._utterances.append(
                {
                    "id": self._utterance_seq,
                    "role": role,
                    "status": status,
                    "text": text,
                    "detail": "",
                    "cost_usd": 0.0,
                    "started_at": time.time(),
                    "updated_at": time.time(),
                }
            )
            return self._utterance_seq

    def update_utterance(self, utterance_id: int, **fields: str) -> None:
        with self._lock:
            self._update_utterance_locked(utterance_id, **fields)

    def _update_utterance_locked(self, utterance_id: int, **fields: str) -> None:
        for utterance in self._utterances:
            if utterance["id"] == utterance_id:
                utterance.update(fields)
                utterance["updated_at"] = time.time()
                return

    def latest_utterance_id(self, role: str) -> int:
        with self._lock:
            for utterance in reversed(self._utterances):
                if utterance["role"] == role:
                    return utterance["id"]
            return 0

    def utterances(self) -> list[dict]:
        with self._lock:
            return [dict(u) for u in self._utterances]

    def add_transcript(self, text: str, utterance_id: int = 0) -> None:
        with self._lock:
            now = time.time()
            self._transcripts.append(
                Transcript(text=text, timestamp=now, utterance_id=utterance_id)
            )
            self._last_transcript_at = now
            self._add_event_locked("transcript", text)
            self._update_utterance_locked(
                utterance_id, status="ready — awaiting pickup", text=text
            )

    def drain(self) -> list[Transcript]:
        with self._lock:
            transcripts, self._transcripts = self._transcripts, []
            if transcripts:
                self._add_event_locked(
                    "delivered", " ".join(t.text for t in transcripts)
                )
                for transcript in transcripts:
                    self._update_utterance_locked(
                        transcript.utterance_id, status="delivered to Claude"
                    )
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
            return self._paused or self._user_muted

    def set_paused(self, paused: bool) -> None:
        with self._lock:
            self._paused = paused

    @property
    def user_muted(self) -> bool:
        with self._lock:
            return self._user_muted

    def set_user_muted(self, muted: bool) -> None:
        with self._lock:
            self._user_muted = muted
