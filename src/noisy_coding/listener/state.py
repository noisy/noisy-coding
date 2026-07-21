"""Shared, thread-safe state between the audio loop and the HTTP API."""

import threading
import time
from collections import deque
from dataclasses import dataclass

from noisy_coding.listener.vad import (
    DEFAULT_MIC_SENSITIVITY,
    MAX_MIC_SENSITIVITY,
    MIN_MIC_SENSITIVITY,
)

EVENT_LOG_SIZE = 300
# On the segmented dials values land on 20-point stops, so the defaults sit
# on a stop too (50 fell between ticks). Sensible starting persona rather than
# everything mid-scale: a little humour, fairly frank, fairly brief, moderately
# chatty — nothing maxed out.
DEFAULT_CHARACTER = {"humor": 20, "honesty": 60, "brevity": 60, "chatty": 40}
DEFAULT_VOICE = "carina"
DEFAULT_SPEED = 1.0
MIN_SPEED, MAX_SPEED = 0.7, 1.5
DEFAULT_END_SILENCE_MS = 2000
MIN_END_SILENCE_MS, MAX_END_SILENCE_MS = 500, 4000
# An agent whose heartbeat (drain polls every 0.5 s, tool hooks during a
# turn) has been silent this long is shown OFFLINE — never deleted (#11).
# Generous on purpose: a brief hiccup must not bounce a tab out of the
# active group (and thereby scramble its position); the flip back to
# online is immediate on the first heartbeat.
AGENT_OFFLINE_AFTER_SECONDS = 30.0
DEFAULT_SMART_TURN = 0.0  # 0 = off (pure VAD); 0.5-0.9 = semantic endpointing
# Push-to-talk hold is a LEASE, not a latch: the UI renews it (~2×/s) while
# the button is physically held, so a crashed page or lost connection can
# never leave the daemon stuck recording. Structural safety, not a timer
# guessing at human behavior.
PTT_LEASE_SECONDS = 2.0
# Same structural-safety pattern for the browser-tab audio device: the tab
# renews the lease with every audio/heartbeat message, so a closed or
# crashed tab frees the device by itself — no timer guessing.
TAB_AUDIO_LEASE_SECONDS = 2.0
# Chatty-driven narration nudges (#16): how long an agent may work in
# silence before the daemon reminds it to say a one-liner. Anchor points,
# linearly interpolated; chatty 0 disables nudging entirely. The model has
# no clock — the daemon does.
CHATTY_NUDGE_ANCHORS = ((25, 600.0), (50, 300.0), (75, 120.0), (100, 75.0))
# "Actively working" = the live-activity line moved this recently. Nudges
# never target an idle agent waiting for the user.
NUDGE_ACTIVITY_FRESH_SECONDS = 30.0


@dataclass(frozen=True)
class Transcript:
    text: str
    timestamp: float
    utterance_id: int = 0
    # Which agent this speech was addressed TO — the agent active when the
    # utterance STARTED (#17). Switching tabs while a sentence is finishing
    # or transcribing must not reroute it. Empty = legacy/unstamped.
    addressee: str = ""


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
        # name -> when the agent last BECAME online (offline->online edge).
        # Orders the active tab group: new arrivals join on the right.
        self._agent_activated: dict[str, float] = {}
        # name -> user-pinned position (drag & drop). Within each tab group,
        # pinned agents come first in pinned order; unpinned follow in the
        # group's natural order.
        self._agent_manual_pos: dict[str, int] = {}
        # Narration nudges (#16): when the agent last spoke (speak/announce
        # SUBMITTED — intent counts, playback may lag) and when we last
        # nudged it, so one silence stretch gets exactly one nudge.
        self._agent_last_spoke: dict[str, float] = {}
        self._agent_last_nudge: dict[str, float] = {}
        # When we last LOGGED an idle-skip for a stretch, so the /logs view
        # gets one "waiting on user" line per stretch — NOT the nudge budget,
        # so an agent that resumes work mid-stretch still earns its nudge.
        self._agent_last_idle_log: dict[str, float] = {}
        self._active_agent: str | None = None
        self._paused = False  # transient echo-mute while Claude speaks
        self._tab_audio_last_beat = float("-inf")  # browser-tab audio lease
        self._tab_mic = False  # the tab's mic is actually capturing
        self._output_device = "system"  # where Claude's voice plays: system | browser
        self._user_muted = False  # explicit mute from the dashboard
        self._voice_muted = False  # speaker-side mute: Claude's speech parks as UNHEARD
        # Per-conversation mute: these agents' speech parks as UNHEARD
        # while everyone else keeps talking (#per-tab-mute).
        self._muted_agents: set[str] = set()
        self._claude_speaking = False  # any agent playing audio right now
        self._speaking_agents: set[str] = set()  # which agents are speaking now
        self._recording = False
        self._mic_level = 0.0  # live mic RMS 0..1, for the dashboard oscilloscope
        self._activity: dict[str, dict] = {}  # agent -> current tool one-liner
        self._playing_utterance_id = 0  # which card is on the speakers right now
        self._latency_ms: dict = {"stt": None, "tts": None}  # last measured
        self._last_recording_end = float("-inf")  # monotonic time of last utterance end
        self._last_transcript_at = 0.0
        self._events: deque[dict] = deque(maxlen=EVENT_LOG_SIZE)
        self._event_seq = 0
        self._utterances: deque[dict] = deque(maxlen=UTTERANCE_LOG_SIZE)
        self._utterance_seq = 0
        self._session_cost_usd = {"user": 0.0, "claude": 0.0}
        # Volume behind the costs: audio seconds transcribed, chars spoken.
        self._usage = {"stt_seconds": 0.0, "tts_chars": 0}
        self._credits_usd: float | None = None
        self._mode = "live"
        self._tts_mode = "live"
        self._end_silence_ms = DEFAULT_END_SILENCE_MS
        self._mic_sensitivity = DEFAULT_MIC_SENSITIVITY
        self._diagnostic_checks: dict | None = None  # live xAI check results
        self._smart_turn = DEFAULT_SMART_TURN
        self._smart_turn_mode = "soft"
        self._detection_mode = "auto"  # auto (VAD) | ptt (push-to-talk)
        self._ptt_last_hold = float("-inf")  # monotonic time of last lease renewal
        self._language = ""  # "" = auto-detect
        self._input_device = ""  # "" = system default microphone
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

    def set_diagnostic_checks(self, checks: dict | None) -> None:
        """Live per-endpoint xAI check results (partial while running) —
        the dashboard polls these to show verdicts landing one by one."""
        with self._lock:
            self._diagnostic_checks = (
                {name: dict(result) for name, result in checks.items()}
                if checks is not None
                else None
            )

    @property
    def diagnostic_checks(self) -> dict | None:
        with self._lock:
            if self._diagnostic_checks is None:
                return None
            return {name: dict(r) for name, r in self._diagnostic_checks.items()}

    @property
    def mic_sensitivity(self) -> int:
        with self._lock:
            return self._mic_sensitivity

    def set_mic_sensitivity(self, value: int) -> int:
        with self._lock:
            self._mic_sensitivity = max(
                MIN_MIC_SENSITIVITY, min(MAX_MIC_SENSITIVITY, int(value))
            )
            return self._mic_sensitivity

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
    def input_device(self) -> str:
        with self._lock:
            return self._input_device

    def set_input_device(self, name: str) -> str:
        with self._lock:
            self._input_device = str(name)
            return self._input_device

    @property
    def output_device(self) -> str:
        with self._lock:
            return self._output_device

    def set_output_device(self, name: str) -> str:
        with self._lock:
            if name in ("system", "browser"):
                self._output_device = name
            return self._output_device

    @property
    def detection_mode(self) -> str:
        with self._lock:
            return self._detection_mode

    def set_detection_mode(self, mode: str) -> str:
        with self._lock:
            if mode in ("auto", "ptt"):
                self._detection_mode = mode
            return self._detection_mode

    def refresh_tab_audio(self) -> None:
        with self._lock:
            self._tab_audio_last_beat = time.monotonic()

    def release_tab_audio(self) -> None:
        with self._lock:
            self._tab_audio_last_beat = float("-inf")
            self._tab_mic = False

    @property
    def tab_audio_alive(self) -> bool:
        with self._lock:
            return (
                time.monotonic() - self._tab_audio_last_beat < TAB_AUDIO_LEASE_SECONDS
            )

    def set_tab_mic(self, live: bool) -> None:
        """The tab's own word on its microphone (heartbeat flag): a
        connected tab can PLAY audio while its mic still awaits the
        activation click — the lease alone must not imply a live mic."""
        with self._lock:
            self._tab_mic = bool(live)

    @property
    def tab_mic_live(self) -> bool:
        with self._lock:
            alive = (
                time.monotonic() - self._tab_audio_last_beat < TAB_AUDIO_LEASE_SECONDS
            )
            return alive and self._tab_mic

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

    def add_usage(self, kind: str, amount: float) -> None:
        with self._lock:
            self._usage[kind] = self._usage.get(kind, 0) + amount

    @property
    def usage(self) -> dict:
        with self._lock:
            return dict(self._usage)

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
                    # style: Claude's (and system rows') counts on arrival;
                    # the user's counts when their utterance is finished
                    # (0 until then — still in the composer).
                    "committed_at": 0.0 if role == "user" else time.time(),
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

    def snapshot_utterances(self) -> list[dict]:
        with self._lock:
            return [dict(u) for u in self._utterances]

    def load_utterances(self, items: list[dict]) -> None:
        """Restore history saved by a previous daemon run.

        In-flight statuses are coerced to terminal ones — their work died
        with the old process: a half-recorded user utterance is dropped
        (hidden as noise), Claude speech that never played becomes UNHEARD
        (still replayable via catch-up).
        """
        with self._lock:
            for item in items:
                utterance = dict(item)
                status = str(utterance.get("status", "")).lower()
                role = utterance.get("role")
                if role == "user" and any(
                    k in status for k in ("recording", "transcribing", "ready")
                ):
                    # "ready" too: the transcript queue is in-memory, so an
                    # awaiting-pickup card can never be delivered by the new
                    # process — without this it shows AWAITING CLAUDE forever.
                    utterance["status"] = "dropped — daemon restart"
                if role in ("claude", "daemon") and any(
                    k in status
                    for k in ("queued", "synthesizing", "ready", "playing", "waiting")
                ):
                    utterance["status"] = "unheard — daemon restarted"
                self._utterances.append(utterance)
                self._utterance_seq = max(self._utterance_seq, int(utterance.get("id", 0)))

    def utterances(self, agent: str | None = None) -> list[dict]:
        with self._lock:
            items = [dict(u) for u in self._utterances]
        if agent is not None:
            items = [u for u in items if u.get("agent") == agent]
        return items

    def add_transcript(self, text: str, utterance_id: int = 0) -> None:
        with self._lock:
            now = time.time()
            # Address the transcript to the agent stamped on its utterance
            # card — that card was created at RECORDING START, so this is
            # "who the user started talking to" (#17), not whoever's tab is
            # active by the time transcription finishes.
            addressee = ""
            for utterance in self._utterances:
                if utterance["id"] == utterance_id:
                    addressee = str(utterance.get("agent") or "")
                    break
            if not addressee:
                addressee = self._active_agent or ""
            self._transcripts.append(
                Transcript(
                    text=text,
                    timestamp=now,
                    utterance_id=utterance_id,
                    addressee=addressee,
                )
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
            # Register/refresh the caller. No agent given → single-agent
            # mode (everyone drains everything).
            if agent is not None:
                self._touch_agent_locked(agent)
                if self._active_agent is None:
                    self._active_agent = agent  # first to register wins by default
                # Deliver by ADDRESSEE (stamped at recording start, #17).
                # Unstamped transcripts keep the old rule: active agent only.
                transcripts = [
                    t
                    for t in self._transcripts
                    if t.addressee == agent
                    or (not t.addressee and agent == self._active_agent)
                ]
                if not transcripts:
                    return []
                delivered_ids = {id(t) for t in transcripts}
                self._transcripts = [
                    t for t in self._transcripts if id(t) not in delivered_ids
                ]
            else:
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

    def _touch_agent_locked(self, name: str) -> None:
        # Heartbeat. An offline->online edge re-stamps activated_at, which
        # places the tab at the right end of the active group (#11).
        now = time.time()
        seen = self._agents.get(name)
        if seen is None or now - seen > AGENT_OFFLINE_AFTER_SECONDS:
            self._agent_activated[name] = now
        self._agents[name] = now

    @property
    def agents(self) -> dict:
        # Known agents are never pruned (#11): a silent agent is shown
        # offline by the dashboard, deleted only by an explicit dismiss.
        with self._lock:
            return dict(self._agents)

    @property
    def agent_labels(self) -> dict:
        # name -> label; falls back to the name itself when no label was given.
        with self._lock:
            return {n: self._agent_labels.get(n, n) for n in self._agents}

    @property
    def agents_meta(self) -> dict:
        """Tab data for the dashboard: online state and group ordering keys.

        online: heartbeat within AGENT_OFFLINE_AFTER_SECONDS (hysteresis: the
        threshold is generous, the return is instant on the next heartbeat).
        activated_at orders the active group (arrival order); offline_since
        orders the offline group (most recently ended first).
        """
        now = time.time()
        with self._lock:
            meta = {}
            for name, seen in self._agents.items():
                online = now - seen <= AGENT_OFFLINE_AFTER_SECONDS
                meta[name] = {
                    "label": self._agent_labels.get(name, name),
                    "online": online,
                    "activated_at": self._agent_activated.get(name, seen),
                    "offline_since": None if online else seen + AGENT_OFFLINE_AFTER_SECONDS,
                    "manual_pos": self._agent_manual_pos.get(name),
                }
            return meta

    @property
    def queued_by_agent(self) -> dict:
        """Utterances WAITING TO BE HEARD per agent — the tab WAIT counter.

        Counts the agent→user direction (speech queued, synthesizing or
        parked unheard — everything except the clip playing right now),
        which is what "messages are waiting" means to the user watching
        the dashboard. The user→agent transcript queue is a different
        thing and deliberately not mixed in.
        """
        waiting_markers = ("queued", "synthesizing", "waiting", "unheard")
        with self._lock:
            counts: dict[str, int] = {}
            for utterance in self._utterances:
                if utterance.get("role") not in ("claude", "daemon"):
                    continue
                if utterance["id"] == self._playing_utterance_id:
                    continue
                status = str(utterance.get("status", ""))
                if any(marker in status for marker in waiting_markers):
                    key = str(utterance.get("agent") or "")
                    counts[key] = counts.get(key, 0) + 1
            return counts

    @property
    def latest_version(self) -> str | None:
        """Newest published release, refreshed by the background check."""
        with self._lock:
            return getattr(self, "_latest_version", None)

    def set_latest_version(self, version: str) -> None:
        with self._lock:
            self._latest_version = version

    @property
    def muted_agents(self) -> list:
        with self._lock:
            return sorted(self._muted_agents)

    def set_agent_muted(self, agent: str, muted: bool) -> list:
        with self._lock:
            if muted:
                self._muted_agents.add(agent)
            else:
                self._muted_agents.discard(agent)
            return sorted(self._muted_agents)

    def agent_muted(self, agent: str | None) -> bool:
        """Whether this agent's speech should park. Utterances without an
        agent belong to the active conversation — judge them by it."""
        with self._lock:
            key = agent or self._active_agent
            return key in self._muted_agents if key else False

    def note_agent_spoke(self, agent: str | None) -> None:
        """A speak/announce arrived — reset this agent's silence clock."""
        with self._lock:
            key = agent or self._active_agent
            if key:
                self._agent_last_spoke[key] = time.time()
                self._add_event_locked("nudge", f"clock reset — '{key}' spoke")

    @staticmethod
    def _nudge_threshold_seconds(chatty: int) -> float | None:
        """Silence budget for a chatty level; None = never nudge."""
        if chatty <= 0:
            return None
        anchors = CHATTY_NUDGE_ANCHORS
        if chatty <= anchors[0][0]:
            return anchors[0][1]
        for (lo_c, lo_s), (hi_c, hi_s) in zip(anchors, anchors[1:]):
            if chatty <= hi_c:
                fraction = (chatty - lo_c) / (hi_c - lo_c)
                return lo_s + (hi_s - lo_s) * fraction
        return anchors[-1][1]

    def nudge_clocks(self) -> dict[str, dict]:
        """Read-only snapshot of every known agent's silence clock, for the
        dashboard's live counter (#16). Pure: mutates nothing, so it is safe
        to call on every /status poll. Per agent: how long it's been silent,
        its chatty budget (None = nudging off), and whether its activity line
        is fresh enough to be nudge-eligible right now."""
        now = time.time()
        with self._lock:
            clocks: dict[str, dict] = {}
            for agent in self._agent_activated:
                character = self._characters.get(agent, self._characters[""])
                chatty = int(character.get("chatty", 50))
                started = self._agent_last_spoke.get(
                    agent, self._agent_activated.get(agent, now)
                )
                activity = self._activity.get(agent)
                fresh = bool(activity) and now - activity.get("at", 0) <= NUDGE_ACTIVITY_FRESH_SECONDS
                clocks[agent] = {
                    "silence": round(now - started, 1),
                    "threshold": self._nudge_threshold_seconds(chatty),
                    "fresh": fresh,
                }
            return clocks

    def pop_due_nudge(self, agent: str) -> str | None:
        """A [SYSTEM] narration reminder, when this agent has earned one.

        Fires only while the agent is ACTIVELY working (fresh activity
        line), after a silence longer than its chatty budget, and at most
        once per silence stretch. The model has no sense of elapsed time —
        this is the daemon lending it a clock (#16).
        """
        now = time.time()
        with self._lock:
            character = self._characters.get(agent, self._characters[""])
            chatty = int(character.get("chatty", 50))
            brevity = int(character.get("brevity", 50))
            threshold = self._nudge_threshold_seconds(chatty)
            if threshold is None:
                return None
            silence_started = self._agent_last_spoke.get(
                agent, self._agent_activated.get(agent, now)
            )
            silence = now - silence_started
            # Below budget: the common every-poll case. Stay silent in the
            # event log — only decisions AT/PAST the budget are worth logging.
            if silence < threshold:
                return None
            # Past budget from here: log the outcome exactly once per silence
            # stretch (dedup on the same guard the nudge itself uses), so the
            # /logs view shows WHY a due nudge did or didn't fire without the
            # 0.5s stop-hook poll flooding it.
            already_nudged = self._agent_last_nudge.get(agent, 0) > silence_started
            activity = self._activity.get(agent)
            is_fresh = bool(activity) and now - activity.get("at", 0) <= NUDGE_ACTIVITY_FRESH_SECONDS
            if not is_fresh:
                # Log the idle-skip once per stretch, but do NOT spend the
                # nudge budget — resuming work later in this stretch must
                # still fire a real nudge.
                if self._agent_last_idle_log.get(agent, 0) <= silence_started:
                    self._agent_last_idle_log[agent] = now
                    self._add_event_locked(
                        "nudge",
                        f"skipped — idle {round(silence)}s (activity stale/absent), "
                        f"waiting on user",
                    )
                return None  # idle or between turns — never nag a waiting agent
            if already_nudged:
                return None  # this stretch was already nudged once
            self._agent_last_nudge[agent] = now
            minutes = max(1, round(silence / 60))
            self._add_event_locked(
                "nudge",
                f"SENT — silent {round(silence)}s ≥ {round(threshold)}s "
                f"budget (chatty {chatty})",
            )
            # chatty decides WHEN to speak up; brevity decides HOW LONG the
            # update gets to be — a 10-minute stretch may deserve more than
            # one line when the user runs low brevity.
            return (
                f"[SYSTEM] You have been working silently for ~{minutes} min and the "
                f"user's chatty setting is {chatty}/100 — give a spoken progress "
                f"update (announce), sized to the user's brevity setting "
                f"({brevity}/100), then continue working."
            )

    def reorder_agents(self, order: list[str]) -> None:
        """Pin a user-chosen tab order (drag & drop). The dashboard sends the
        full resulting order of ONE group; unknown names are ignored."""
        with self._lock:
            for position, name in enumerate(order):
                if name in self._agents:
                    self._agent_manual_pos[name] = position

    def dismiss_agent(self, name: str) -> bool:
        """Drop an agent's tab. Only offline, non-active conversations may go:
        dismissing the active agent would silently reroute the user's speech,
        and an online one is still someone's live session."""
        with self._lock:
            seen = self._agents.get(name)
            if seen is None or name == self._active_agent:
                return False
            if time.time() - seen <= AGENT_OFFLINE_AFTER_SECONDS:
                return False
            del self._agents[name]
            self._agent_labels.pop(name, None)
            self._agent_activated.pop(name, None)
            self._agent_manual_pos.pop(name, None)
            self._muted_agents.discard(name)
            self._agent_last_spoke.pop(name, None)
            self._agent_last_nudge.pop(name, None)
            self._agent_last_idle_log.pop(name, None)
            self._activity.pop(name, None)
            return True

    @property
    def active_agent(self) -> str | None:
        with self._lock:
            return self._active_agent

    def register_agent(self, name: str, label: str = "") -> None:
        with self._lock:
            self._touch_agent_locked(name)
            if label:
                # A fallback label (the shortened agent id) must not evict a
                # real title: hooks re-register on every call, and the ones
                # that cannot read the transcript would otherwise keep
                # reverting the tab to the bare hash.
                is_fallback = label == name or label == name[:8]
                if not (is_fallback and self._agent_labels.get(name)):
                    self._agent_labels[name] = label
            if self._active_agent is None:
                self._active_agent = name

    def set_active_agent(self, name: str) -> str | None:
        with self._lock:
            if name in self._agents:
                self._active_agent = name
            return self._active_agent

    def restore_active_agent(self, name: str) -> None:
        """Carry the user's chosen agent across a daemon restart.

        Registered as a (possibly not-yet-returned) agent so its tab stays
        visible and later registrations can't win the empty-slate race that
        used to hand the mic to whichever agent polled first after boot.
        """
        with self._lock:
            self._agents.setdefault(name, time.time())
            self._active_agent = name

    @property
    def queued_count(self) -> int:
        with self._lock:
            return len(self._transcripts)

    @property
    def last_transcript_at(self) -> float:
        with self._lock:
            return self._last_transcript_at

    def set_latency(self, kind: str, milliseconds: float) -> None:
        with self._lock:
            self._latency_ms[kind] = int(milliseconds)

    @property
    def latency_ms(self) -> dict:
        with self._lock:
            return dict(self._latency_ms)

    def set_activity(self, agent: str, text: str) -> None:
        """What an agent is doing right now (one line from the hooks)."""
        with self._lock:
            if text:
                self._activity[agent] = {"text": text, "at": time.time()}
            else:
                self._activity.pop(agent, None)  # turn ended — idle

    @property
    def activity(self) -> dict:
        with self._lock:
            return {agent: dict(entry) for agent, entry in self._activity.items()}

    @property
    def playing_utterance_id(self) -> int:
        with self._lock:
            return self._playing_utterance_id

    def interrupt_playing_as_unheard(self, reason: str, agent: str | None = None) -> int:
        """Mute pressed mid-clip: park the playing utterance as UNHEARD.

        The clip was cut short, so it must not read "played" — catch-up
        should replay it in full. With `agent` given, only fires when the
        playing clip belongs to that conversation (agent-less clips count
        as the active one). Returns the interrupted id, 0 if none.
        """
        with self._lock:
            utterance_id = self._playing_utterance_id
            if not utterance_id:
                return 0
            for utterance in self._utterances:
                if utterance["id"] != utterance_id:
                    continue
                owner = utterance.get("agent") or self._active_agent
                if agent is not None and owner != agent:
                    return 0
                utterance["status"] = f"unheard — {reason}"
                utterance["updated_at"] = time.time()
                break
            self._playing_utterance_id = 0
            return utterance_id

    def utterance_is_unheard(self, utterance_id: int) -> bool:
        with self._lock:
            for utterance in self._utterances:
                if utterance["id"] == utterance_id:
                    return "unheard" in str(utterance.get("status", ""))
            return False

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
