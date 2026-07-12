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
# An agent that hasn't drained the queue in this long is treated as gone.
# Live agents poll far more often than this (PostToolUse + Stop rewake).
AGENT_TTL_SECONDS = 90
DEFAULT_SMART_TURN = 0.0  # 0 = off (pure VAD); 0.5-0.9 = semantic endpointing
# Push-to-talk hold is a LEASE, not a latch: the UI renews it (~2×/s) while
# the button is physically held, so a crashed page or lost connection can
# never leave the daemon stuck recording. Structural safety, not a timer
# guessing at human behavior.
PTT_LEASE_SECONDS = 2.0


@dataclass(frozen=True)
class Transcript:
    text: str
    timestamp: float
    utterance_id: int = 0


UTTERANCE_LOG_SIZE = 100


class ListenerState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        # Signals every change to the recording/paused/muted flags, so
        # waiters (the playback gate) block on a condition instead of polling.
        self._turn_cond = threading.Condition(self._lock)
        self._transcripts: list[Transcript] = []
        # Multi-agent: registered agents by name, and which one is active.
        # Transcripts are only delivered to the active agent (see drain).
        self._agents: dict[str, float] = {}  # name -> last-seen time
        self._agent_labels: dict[str, str] = {}  # name -> human label (rename title)
        self._active_agent: str | None = None
        self._paused = False  # transient echo-mute while Claude speaks
        self._user_muted = False  # explicit mute from the dashboard
        self._voice_muted = False  # speaker-side mute: Claude's speech parks as UNHEARD
        self._claude_speaking = False  # any agent playing audio right now
        self._speaking_agents: set[str] = set()  # which agents are speaking now
        self._recording = False
        self._mic_level = 0.0  # live mic RMS 0..1, for the dashboard oscilloscope
        self._playing_utterance_id = 0  # which card is on the speakers right now
        self._last_recording_end = float("-inf")  # monotonic time of last utterance end
        self._last_transcript_at = 0.0
        self._events: deque[dict] = deque(maxlen=EVENT_LOG_SIZE)
        self._event_seq = 0
        self._utterances: deque[dict] = deque(maxlen=UTTERANCE_LOG_SIZE)
        self._utterance_seq = 0
        self._session_cost_usd = {"user": 0.0, "claude": 0.0}
        self._credits_usd: float | None = None
        self._mode = "batch"
        self._tts_mode = "batch"
        self._end_silence_ms = DEFAULT_END_SILENCE_MS
        self._smart_turn = DEFAULT_SMART_TURN
        self._smart_turn_mode = "soft"
        self._detection_mode = "auto"  # auto (VAD) | ptt (push-to-talk)
        self._ptt_last_hold = float("-inf")  # monotonic time of last lease renewal
        self._language = ""  # "" = auto-detect
        # Character is now PER AGENT: {agent_name: character_dict}. The special
        # key "" holds the character used in single-agent mode (no agents
        # registered) and as the template for a newly seen agent.
        self._characters: dict[str, dict] = {"": self._default_character()}

    @staticmethod
    def _default_character() -> dict:
        return dict(DEFAULT_CHARACTER) | {"voice": DEFAULT_VOICE, "speed": DEFAULT_SPEED}

    def _character_bucket(self, agent: str | None) -> str:
        # No agent given → use the active agent's bucket, else the shared one.
        key = agent if agent is not None else (self._active_agent or "")
        if key not in self._characters:
            # Seed a new agent from the shared/default character.
            self._characters[key] = dict(self._characters[""])
        return key

    def character(self, agent: str | None = None) -> dict:
        with self._lock:
            return dict(self._characters[self._character_bucket(agent)])

    def set_character(self, values: dict, agent: str | None = None) -> dict:
        with self._lock:
            key = self._character_bucket(agent)
            char = self._characters[key]
            for trait in DEFAULT_CHARACTER:
                if trait in values:
                    char[trait] = max(0, min(100, int(values[trait])))
            voice = values.get("voice")
            if isinstance(voice, str) and voice.isalpha():
                char["voice"] = voice.lower()
            if "speed" in values:
                try:
                    char["speed"] = max(MIN_SPEED, min(MAX_SPEED, float(values["speed"])))
                except (TypeError, ValueError):
                    pass
            return dict(char)

    def all_characters(self) -> dict:
        with self._lock:
            return {k: dict(v) for k, v in self._characters.items()}

    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    def set_mode(self, mode: str) -> None:
        with self._lock:
            self._mode = mode

    @property
    def tts_mode(self) -> str:
        with self._lock:
            return self._tts_mode

    def set_tts_mode(self, mode: str) -> None:
        with self._lock:
            self._tts_mode = mode

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

    @property
    def smart_turn(self) -> float:
        with self._lock:
            return self._smart_turn

    def set_smart_turn(self, value: float) -> float:
        with self._lock:
            self._smart_turn = max(0.0, min(1.0, float(value)))
            return self._smart_turn

    @property
    def language(self) -> str:
        with self._lock:
            return self._language

    def set_language(self, language: str) -> str:
        with self._lock:
            self._language = language
            return self._language

    @property
    def detection_mode(self) -> str:
        with self._lock:
            return self._detection_mode

    def set_detection_mode(self, mode: str) -> str:
        with self._lock:
            if mode in ("auto", "ptt"):
                self._detection_mode = mode
            return self._detection_mode

    def refresh_ptt_hold(self) -> None:
        with self._lock:
            self._ptt_last_hold = time.monotonic()

    def release_ptt(self) -> None:
        with self._lock:
            self._ptt_last_hold = float("-inf")

    @property
    def ptt_held(self) -> bool:
        with self._lock:
            return time.monotonic() - self._ptt_last_hold < PTT_LEASE_SECONDS

    @property
    def smart_turn_mode(self) -> str:
        with self._lock:
            return self._smart_turn_mode

    def set_smart_turn_mode(self, mode: str) -> str:
        with self._lock:
            if mode in ("soft", "hard"):
                self._smart_turn_mode = mode
            return self._smart_turn_mode

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

    def create_utterance(
        self, role: str, status: str, text: str = "", agent: str | None = None
    ) -> int:
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
                    # Which agent this utterance belongs to. Claude's speech
                    # passes its own agent explicitly (it may no longer be the
                    # active one by the time it speaks); user speech defaults
                    # to the active agent it was delivered to.
                    "agent": agent if agent is not None else self._active_agent,
                    "started_at": time.time(),
                    "updated_at": time.time(),
                    # When the message ENTERED the conversation, iMessage
                    # style: Claude's counts on arrival (queued — the user
                    # may consciously ignore it while composing); the
                    # user's counts when their utterance is finished (0
                    # until then — still in the composer).
                    "committed_at": time.time() if role == "claude" else 0.0,
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

    def latest_utterance_id(self, role: str, agent: str | None = None) -> int:
        with self._lock:
            for utterance in reversed(self._utterances):
                if utterance["role"] == role and (
                    agent is None or utterance.get("agent") == agent
                ):
                    return utterance["id"]
            return 0

    def utterances(self, agent: str | None = None) -> list[dict]:
        with self._lock:
            items = [dict(u) for u in self._utterances]
        if agent is not None:
            items = [u for u in items if u.get("agent") == agent]
        return items

    def add_transcript(self, text: str, utterance_id: int = 0) -> None:
        with self._lock:
            now = time.time()
            self._transcripts.append(
                Transcript(text=text, timestamp=now, utterance_id=utterance_id)
            )
            self._last_transcript_at = now
            self._add_event_locked("transcript", text)
            self._update_utterance_locked(
                utterance_id,
                status="ready — awaiting pickup",
                text=text,
                committed_at=now,
            )

    def cancel_transcript(self, utterance_id: int) -> bool:
        """Drop a queued transcript before it reaches Claude.

        Only possible while it still sits in the queue — once drained it's
        Claude's; we return False and the card keeps its delivered status.
        """
        with self._lock:
            kept = [t for t in self._transcripts if t.utterance_id != utterance_id]
            cancelled = len(kept) < len(self._transcripts)
            if cancelled:
                self._transcripts = kept
                self._add_event_locked("cancelled", f"utterance {utterance_id} recalled")
                self._update_utterance_locked(utterance_id, status="cancelled by you")
            return cancelled

    def drain(self, agent: str | None = None) -> list[Transcript]:
        with self._lock:
            # Register/refresh the caller and gate delivery on active agent.
            # No agent registered yet → single-agent mode (everyone drains).
            if agent is not None:
                self._agents[agent] = time.time()
                if self._active_agent is None:
                    self._active_agent = agent  # first to register wins by default
                if agent != self._active_agent:
                    return []  # not your turn — the active agent gets the speech
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

    def _prune_stale_agents_locked(self) -> None:
        # Agents drain the queue constantly (PostToolUse/Stop), refreshing their
        # last-seen time. One that hasn't polled in AGENT_TTL_SECONDS is gone
        # (reconnected under a new id, closed, crashed) — drop it so dead tabs
        # like a renamed "work" don't linger.
        now = time.time()
        stale = [n for n, seen in self._agents.items() if now - seen > AGENT_TTL_SECONDS]
        for name in stale:
            del self._agents[name]
            self._agent_labels.pop(name, None)
            if self._active_agent == name:
                self._active_agent = next(iter(self._agents), None)

    @property
    def agents(self) -> dict:
        with self._lock:
            self._prune_stale_agents_locked()
            return dict(self._agents)

    @property
    def agent_labels(self) -> dict:
        # name -> label; falls back to the name itself when no label was given.
        with self._lock:
            self._prune_stale_agents_locked()
            return {n: self._agent_labels.get(n, n) for n in self._agents}

    @property
    def active_agent(self) -> str | None:
        with self._lock:
            return self._active_agent

    def register_agent(self, name: str, label: str = "") -> None:
        with self._lock:
            self._agents[name] = time.time()
            if label:
                self._agent_labels[name] = label
            if self._active_agent is None:
                self._active_agent = name

    def set_active_agent(self, name: str) -> str | None:
        with self._lock:
            if name in self._agents:
                self._active_agent = name
            return self._active_agent

    @property
    def queued_count(self) -> int:
        with self._lock:
            return len(self._transcripts)

    @property
    def last_transcript_at(self) -> float:
        with self._lock:
            return self._last_transcript_at

    @property
    def playing_utterance_id(self) -> int:
        with self._lock:
            return self._playing_utterance_id

    def set_playing_utterance_id(self, utterance_id: int) -> None:
        with self._lock:
            self._playing_utterance_id = utterance_id

    @property
    def mic_level(self) -> float:
        with self._lock:
            return self._mic_level

    def set_mic_level(self, level: float) -> None:
        with self._lock:
            self._mic_level = max(0.0, min(1.0, float(level)))

    @property
    def recording(self) -> bool:
        with self._lock:
            return self._recording

    def set_recording(self, recording: bool) -> None:
        with self._lock:
            if self._recording and not recording:
                self._last_recording_end = time.monotonic()
            self._recording = recording
            self._turn_cond.notify_all()

    def wait_for_user_silence(self, grace_s: float = 0.0) -> None:
        """Block until the user isn't mid-utterance.

        The VAD's end-of-utterance silence window (end_silence_ms /
        smart_turn) is the single definition of "their turn is over", and
        `recording` flips only when the audio loop says so. A paused or
        muted mic cannot be recording, so a stale flag under pause/mute
        counts as silence — that structural rule, not a timer, is what
        makes this wait deadlock-free.

        `grace_s` is conversational courtesy, not a failsafe: for that many
        seconds after an utterance ends the wait keeps holding, so the user
        can tack on a follow-up thought and be waited for again. It counts
        from when the recording actually ended — a wait started long after
        silence returns immediately.
        """
        with self._turn_cond:
            while True:
                while self._recording and not (self._paused or self._user_muted):
                    self._turn_cond.wait()
                if self._paused or self._user_muted:
                    return
                remaining = grace_s - (time.monotonic() - self._last_recording_end)
                if remaining <= 0:
                    return
                # Wakes early if the user resumes speaking (outer loop holds
                # again) or a flag changes; otherwise re-checks the grace.
                self._turn_cond.wait(timeout=remaining)

    @property
    def paused(self) -> bool:
        with self._lock:
            return self._paused or self._user_muted

    def set_paused(self, paused: bool) -> None:
        with self._lock:
            self._paused = paused
            self._turn_cond.notify_all()

    @property
    def claude_speaking(self) -> bool:
        with self._lock:
            return self._claude_speaking

    @property
    def speaking_agents(self) -> list:
        with self._lock:
            return sorted(self._speaking_agents)

    def set_claude_speaking(self, speaking: bool, agent: str | None = None) -> None:
        with self._lock:
            self._claude_speaking = speaking
            if agent:
                if speaking:
                    self._speaking_agents.add(agent)
                else:
                    self._speaking_agents.discard(agent)

    @property
    def voice_muted(self) -> bool:
        with self._lock:
            return self._voice_muted

    def set_voice_muted(self, muted: bool) -> None:
        with self._lock:
            self._voice_muted = muted

    @property
    def user_muted(self) -> bool:
        with self._lock:
            return self._user_muted

    def set_user_muted(self, muted: bool) -> None:
        with self._lock:
            self._user_muted = muted
            self._turn_cond.notify_all()
