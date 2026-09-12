"""Codex-specific facts the contract suite cannot know."""

from __future__ import annotations

from noisy_coding.harness.codex_hooks.adapter import CodexHooks


def _title(payload):
    events = CodexHooks(agent_label="Codex").interpret(payload).events
    started = [e for e in events if e.kind == "session_started"]
    if started and started[0].title:
        return started[0].title
    titled = [e for e in events if e.kind == "title_changed"]
    return titled[0].title if titled else ""


def test_codex_tab_is_named_by_its_project_with_a_short_id():
    title = _title({"hook_event_name": "SessionStart",
                    "session_id": "codex-0a1b2c3d", "cwd": "/Users/dev/noisy-coding"})
    assert title == "Codex · noisy-coding · codex-"


def test_two_codex_threads_in_one_project_stay_distinct():
    a = _title({"hook_event_name": "Stop", "session_id": "a1a1a1a1-1", "cwd": "/w/proj"})
    b = _title({"hook_event_name": "Stop", "session_id": "b2b2b2b2-2", "cwd": "/w/proj"})
    assert a != b and a.startswith("Codex · proj ·") and b.startswith("Codex · proj ·")


def test_codex_without_a_cwd_falls_back_to_the_id():
    title = _title({"hook_event_name": "SessionStart", "session_id": "codex-deadbeef"})
    assert title == "Codex · codex-de"


def test_codex_keys_by_session_id_and_never_drains_a_participant():
    result = CodexHooks().interpret(
        {"hook_event_name": "PostToolUse", "session_id": "codex-x", "agent_id": "sub-1", "cwd": "/w/p"})
    assert result.conversation == "codex-x"
    assert result.participant == "sub-1"
    assert result.may_drain is False
