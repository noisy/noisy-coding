"""Codex lifecycle hooks -> the harness contract.

Codex runs the same five hooks with the same stdin shape as Claude Code,
but its Stop hook is synchronous: while our listener polls, the turn is
not finished and anything the user types waits behind it. So the window is
short by default and the daemon shows the tab as deaf afterwards instead
of holding the turn open for an hour. Identity is the Codex `session_id`;
there is no transcript path to key on.
"""

from __future__ import annotations

from noisy_coding.harness.base import (
    Capabilities,
    Delivery,
    Event,
    HarnessError,
    Interpretation,
    Moment,
)
from noisy_coding.harness.hook_common import (
    THINKING,
    activity_line,
    hook_delivery,
    is_identity_tool,
)

DEFAULT_LISTEN_SECONDS = 30.0
DEFAULT_LABEL = "Codex"


class CodexHooks:
    name = "codex-hooks"
    label = "Codex"

    def __init__(
        self, listen_seconds: float = DEFAULT_LISTEN_SECONDS, agent_label: str = DEFAULT_LABEL
    ) -> None:
        self.capabilities = Capabilities(
            wake="long_poll",
            max_idle_seconds=listen_seconds,
            liveness="heuristic",
            mid_turn_delivery=True,
            spawn=False,
        )
        self._agent_label = agent_label

    def interpret(self, payload: dict) -> Interpretation:
        if not isinstance(payload, dict):
            raise HarnessError("hook input must be an object")
        session_id = str(payload.get("session_id") or "").strip()
        if not session_id:
            raise HarnessError("Codex hook payload names no session")
        key = session_id
        participant = str(payload.get("agent_id") or "").strip() or None
        event_name = str(payload.get("hook_event_name") or "")
        title = f"{self._agent_label} · {session_id[:8]}"
        events: list[Event] = []
        may_drain = False
        listener = "none"
        speech_identity = None

        def add(kind, **fields):
            events.append(Event(kind, key, (), participant=participant, **fields))

        if event_name == "SessionStart":
            add("session_started", source=str(payload.get("source") or ""), title=title)
        elif event_name == "SessionEnd":
            add("session_ended")
        elif event_name == "UserPromptSubmit":
            add("turn_started")
            add("activity", detail=THINKING)
        elif event_name == "PreToolUse":
            line = activity_line(payload)
            if line:
                add("activity", detail=line)
            if is_identity_tool(payload.get("tool_name", "")):
                speech_identity = key
        elif event_name == "PostToolUse":
            add("activity", detail=THINKING)
            may_drain = participant is None
        elif event_name == "Stop":
            add("turn_ended")
            listener = "poll"
        elif event_name == "SubagentStart":
            add("participant_started")
        elif event_name == "SubagentStop":
            add("participant_ended")
        else:
            add("activity", detail="")
        if event_name != "SessionStart":
            events.append(Event("title_changed", key, (), title=title))
        return Interpretation(
            conversation=key,
            events=tuple(events),
            may_drain=may_drain,
            speech_identity=speech_identity,
            listener=listener,
            short_id=session_id[:8],
            participant=participant,
        )

    def deliver(self, messages: list[str], moment: Moment) -> Delivery:
        return hook_delivery(messages, moment)
