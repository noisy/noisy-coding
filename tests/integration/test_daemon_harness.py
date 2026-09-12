"""The daemon wired to the harness contract, driven over HTTP.

Real ListenerState + registry + HTTP handler; payloads are the recorded
Claude Code fixtures. This proves the wiring - the logic is proven by
tests/harness/.
"""

from __future__ import annotations

import http.client
import json
from pathlib import Path

import pytest

from noisy_coding.listener import http_api
from noisy_coding.listener.http_api import start_http_api
from noisy_coding.listener.state import ListenerState

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "harness" / "claude-hooks"


def _rows(name: str) -> list[dict]:
    return [json.loads(l) for l in (FIXTURES / name).read_text().splitlines() if l.strip()]


@pytest.fixture
def daemon(tmp_path, monkeypatch):
    monkeypatch.setattr(http_api, "DIST_DIR", tmp_path / "missing")
    state = ListenerState()
    server = start_http_api(state, 0)
    port = server.server_address[1]

    def call(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        payload = json.dumps(body).encode() if body is not None else None
        connection.request(method, path, body=payload,
                           headers={"Content-Type": "application/json"} if payload else {})
        response = connection.getresponse()
        return response.status, json.loads(response.read() or b"{}")

    def event(payload: dict) -> dict:
        status, body = call("POST", "/harness/event", {"harness": "claude-hooks", "payload": payload})
        assert status == 200, body
        return body

    yield state, call, event
    server.shutdown()


def test_session_start_creates_the_tab_before_any_message(daemon):
    state, call, event = daemon
    start = _rows("session.jsonl")[0]
    response = event(start)
    key = response["conversation"]
    assert key == start["transcript_path"]
    assert response["listener"] == "start" and response["listener_id"]
    _status, body = call("GET", "/status")
    tab = body["conversations"][key]
    assert tab["label"] == "6eef14ed"
    assert tab["status"] == "idle"
    assert tab["aliases"] == [start["session_id"]]
    assert key in body["agents"]


def test_subagent_never_takes_the_parents_message(daemon):
    state, call, event = daemon
    rows = _rows("participant.jsonl")
    event(rows[0])  # SessionStart
    key = rows[0]["transcript_path"]
    state.add_transcript("reset the counter")
    child = next(r for r in rows if r.get("agent_id") and r["hook_event_name"] == "PostToolUse")
    response = event(child)
    assert response["may_drain"] is False
    assert response["participant"] == child["agent_id"]
    # Only ONE tab exists, and the message is still queued for the parent.
    _status, body = call("GET", "/status")
    assert list(body["conversations"]) == [key]
    parent = next(r for r in rows if not r.get("agent_id") and r["hook_event_name"] == "PostToolUse")
    assert event(parent)["may_drain"] is True
    _status, drained = call("GET", f"/drain?conversation={key}")
    assert [t["text"] for t in drained["transcripts"]] == ["reset the counter"]
    assert drained["delivery"]["exit_code"] == 0
    assert "reset the counter" in drained["delivery"]["context"]


def test_a_stale_listener_stands_down_and_the_current_one_wakes(daemon):
    state, call, event = daemon
    rows = _rows("session.jsonl")
    event(rows[0])
    key = rows[0]["transcript_path"]
    stop = next(r for r in rows if r["hook_event_name"] == "Stop")
    first = event(stop)["listener_id"]
    second = event(stop)["listener_id"]
    utterance_id = state.create_utterance("user", "recording…", agent=key)
    state.add_transcript("are you there", utterance_id)
    _s, stale = call("GET", f"/drain?conversation={key}&listener={first}")
    assert stale == {"transcripts": [], "nudge": None, "stand_down": True}
    _s, current = call("GET", f"/drain?conversation={key}&listener={second}")
    assert current["stand_down"] is False
    assert current["delivery"]["exit_code"] == 2
    assert current["transcripts"][0]["text"] == "are you there"
    assert state.utterances()[-1]["status"] == "delivered to 6eef14ed"


def test_listener_timeout_makes_the_tab_deaf_and_loud(daemon):
    state, call, event = daemon
    rows = _rows("session.jsonl")
    event(rows[0])
    key = rows[0]["transcript_path"]
    listener = event(next(r for r in rows if r["hook_event_name"] == "Stop"))["listener_id"]
    status, body = call("POST", "/harness/listener",
                        {"conversation": rows[0]["session_id"], "listener_id": listener, "reason": "timeout"})
    assert status == 200 and body["status"] == "deaf"
    _s, snapshot = call("GET", "/status")
    assert snapshot["conversations"][key]["status"] == "deaf"
    assert snapshot["conversations"][key]["deaf_reason"] == "timeout"
    assert any(e["kind"] == "deaf" for e in state.events_since(0))


def test_speak_with_a_session_id_lands_on_the_transcript_keyed_tab(daemon, monkeypatch):
    state, call, event = daemon
    rows = _rows("session.jsonl")
    event(rows[0])
    key = rows[0]["transcript_path"]
    submitted = {}

    def fake_submit(_state, text, **kwargs):
        submitted.update(text=text, **kwargs)
        return None  # "dedup raced us" path: responds skipped, no audio

    monkeypatch.setattr(http_api.speech, "submit", fake_submit)
    status, body = call("POST", "/speak", {"text": "hello", "agent": rows[0]["session_id"], "wait": False})
    assert status == 200 and body == {"skipped": True}
    assert submitted["agent"] == key
    assert list(state.agents) == [key]  # no hash tab was conjured


def test_title_from_the_hook_renames_the_tab(daemon):
    state, call, event = daemon
    rows = _rows("title.jsonl")
    event(rows[0])
    key = rows[0]["transcript_path"]
    assert state.agent_labels[key] == "reksio"
    _s, body = call("GET", "/status")
    assert body["conversations"][key]["label"] == "reksio"


def test_bad_payloads_fail_closed(daemon):
    _state, call, _event = daemon
    status, _ = call("POST", "/harness/event", {"harness": "nope", "payload": {}})
    assert status == 400
    status, body = call("POST", "/harness/event", {"harness": "claude-hooks", "payload": {"hook_event_name": "Stop"}})
    assert status == 422 and "session" in body["error"]
