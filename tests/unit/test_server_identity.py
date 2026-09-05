import json

import httpx
import pytest
import respx

from noisy_coding import server


@pytest.mark.asyncio
@respx.mock
async def test_shared_server_interleaves_two_codex_sessions_and_legacy_claude(tmp_path, monkeypatch):
    _write_cwd_map(tmp_path, monkeypatch, "claude-session")
    monkeypatch.delenv("NOISY_CODING_AGENT_NAME", raising=False)
    monkeypatch.delenv("NOISY_CODING_REQUIRE_AGENT_ID", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_SESSION_ID", "claude-session")
    monkeypatch.setenv("NOISY_CODING_LISTENER_PORT", "12345")
    route = respx.post("http://127.0.0.1:12345/speak").mock(return_value=httpx.Response(200, json={"voice": "test"}))

    monkeypatch.setenv("NOISY_CODING_REQUIRE_AGENT_ID", "1")
    await server.speak("A", agent_id="codex-a")
    monkeypatch.delenv("NOISY_CODING_REQUIRE_AGENT_ID")
    await server.speak("Claude", agent_id="forged-other-session")
    monkeypatch.setenv("NOISY_CODING_REQUIRE_AGENT_ID", "1")
    await server.announce("B", agent_id="codex-b")
    await server.speak("A again", agent_id="codex-a")

    assert [json.loads(call.request.content) for call in route.calls] == [
        {"text": "A", "interrupt": False, "wait": True, "agent": "codex-a"},
        {"text": "Claude", "interrupt": False, "wait": True, "agent": "claude-session"},
        {"text": "B", "wait": False, "agent": "codex-b"},
        {"text": "A again", "interrupt": False, "wait": True, "agent": "codex-a"},
    ]


@pytest.mark.asyncio
@respx.mock
async def test_codex_server_without_hook_identity_reports_error_instead_of_speaking(monkeypatch):
    monkeypatch.setenv("NOISY_CODING_REQUIRE_AGENT_ID", "1")
    monkeypatch.setenv("NOISY_CODING_LISTENER_PORT", "12345")
    event = respx.post("http://127.0.0.1:12345/event").mock(return_value=httpx.Response(200, json={"ok": True}))

    result = await server.speak("Never route this by cwd")

    assert "identity is missing" in result
    assert json.loads(event.calls[0].request.content)["kind"] == "voice_identity_error"


@pytest.mark.asyncio
@pytest.mark.parametrize("require_identity, expected", [(False, "claude-session"), (True, "codex-session")])
@respx.mock
async def test_voice_change_only_accepts_host_injected_identity(monkeypatch, require_identity, expected):
    monkeypatch.delenv("NOISY_CODING_REQUIRE_AGENT_ID", raising=False)
    if require_identity:
        monkeypatch.setenv("NOISY_CODING_REQUIRE_AGENT_ID", "1")
    monkeypatch.setenv("NOISY_CODING_AGENT_NAME", "claude-session")
    monkeypatch.setenv("NOISY_CODING_LISTENER_PORT", "12345")
    route = respx.post("http://127.0.0.1:12345/voice").mock(
        return_value=httpx.Response(200, json={"voice": "test"}))

    await server.change_voice("test", agent_id="codex-session")

    assert json.loads(route.calls[0].request.content) == {"voice_id": "test", "agent": expected}


def _write_cwd_map(tmp_path, monkeypatch, agent):
    sessions = tmp_path / "sessions.json"
    monkeypatch.chdir(tmp_path)
    sessions.write_text(json.dumps({str(tmp_path): {"agent": agent, "label": agent}}))
    monkeypatch.setattr(server, "_SESSIONS_MAP", sessions)


def test_agent_name_prefers_the_session_id_over_the_shared_cwd_map(tmp_path, monkeypatch):
    # Two tabs in one directory overwrite each other's cwd-map slot (#15) —
    # the session id from the environment is the deterministic identity.
    _write_cwd_map(tmp_path, monkeypatch, "the-other-tab")
    monkeypatch.delenv("NOISY_CODING_AGENT_NAME", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_SESSION_ID", "my-session")

    assert server._agent_name() == "my-session"


def test_agent_name_explicit_env_name_wins_over_everything(tmp_path, monkeypatch):
    _write_cwd_map(tmp_path, monkeypatch, "mapped")
    monkeypatch.setenv("NOISY_CODING_AGENT_NAME", "fixed-name")
    monkeypatch.setenv("CLAUDE_CODE_SESSION_ID", "my-session")

    assert server._agent_name() == "fixed-name"


def test_agent_name_falls_back_to_the_cwd_map_for_old_clients(tmp_path, monkeypatch):
    _write_cwd_map(tmp_path, monkeypatch, "mapped-agent")
    monkeypatch.delenv("NOISY_CODING_AGENT_NAME", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_SESSION_ID", raising=False)

    assert server._agent_name() == "mapped-agent"


def test_agent_name_empty_when_nothing_identifies_the_session(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(server, "_SESSIONS_MAP", tmp_path / "missing.json")
    monkeypatch.delenv("NOISY_CODING_AGENT_NAME", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_SESSION_ID", raising=False)

    assert server._agent_name() == ""
