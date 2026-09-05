import importlib
import io
import json
from pathlib import Path
from unittest.mock import Mock

import pytest


@pytest.fixture
def adapter(monkeypatch, tmp_path):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2] / "hooks"))
    module = importlib.import_module("codex")
    monkeypatch.setenv("NOISY_CODING_CODEX_CONFIG", str(tmp_path / "codex.json"))
    monkeypatch.delenv("NOISY_CODING_LISTENER_PORT", raising=False)
    monkeypatch.setattr(module.urllib.request, "urlopen", Mock())
    monkeypatch.setattr(module.runpy, "run_path", Mock())
    return module


@pytest.mark.parametrize("tool", ["mcp__noisy_coding__speak", "mcp__noisy-coding__announce", "mcp__plugin_noisy-coding_noisy-coding__change_voice"])
def test_codex_hook_overwrites_forged_identity(adapter, monkeypatch, capsys, tool):
    monkeypatch.setattr(adapter.sys, "stdin", io.StringIO(json.dumps({
        "hook_event_name": "PreToolUse", "session_id": "actual-thread",
        "tool_name": tool, "tool_input": {"text": "hello", "agent_id": "someone-else"},
    })))

    adapter.main()

    assert json.loads(capsys.readouterr().out) == {"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "permissionDecision": "allow",
        "updatedInput": {"text": "hello", "agent_id": "actual-thread"},
    }}


def test_missing_identity_blocks_speech_and_reports_daemon_event(adapter, monkeypatch, capsys):
    monkeypatch.setattr(adapter.sys, "stdin", io.StringIO(json.dumps({
        "hook_event_name": "PreToolUse", "tool_name": "mcp__noisy_coding__speak",
        "tool_input": {"text": "hello", "agent_id": "forged"},
    })))

    adapter.main()

    result = json.loads(capsys.readouterr().out)
    assert result["hookSpecificOutput"]["permissionDecision"] == "deny"
    request = adapter.urllib.request.urlopen.call_args.args[0]
    assert json.loads(request.data) == {"kind": "voice_identity_error", "detail": result["systemMessage"]}
    adapter.runpy.run_path.assert_not_called()


def test_unrelated_mcp_call_is_not_rewritten(adapter, monkeypatch, capsys):
    monkeypatch.setattr(adapter.sys, "stdin", io.StringIO(json.dumps({
        "hook_event_name": "PreToolUse", "session_id": "thread-a",
        "tool_name": "mcp__other__speak", "tool_input": {"text": "hello"},
    })))

    adapter.main()

    assert capsys.readouterr().out == ""


def test_codex_registration_does_not_write_shared_cwd_identity(adapter, monkeypatch, tmp_path):
    identity = importlib.import_module("_agent_identity")
    monkeypatch.setattr(identity, "MAP_FILE", tmp_path / "sessions.json")
    monkeypatch.setattr(identity, "_register", Mock())
    monkeypatch.setenv("NOISY_CODING_HARNESS", "codex")
    monkeypatch.setenv("NOISY_CODING_AGENT_NAME", "thread-a")
    monkeypatch.setenv("NOISY_CODING_SESSION_TITLE", "Custom agent")

    result = identity.identity({"session_id": "thread-a", "cwd": str(tmp_path)})

    assert result == ("thread-a", "Custom agent")
    assert not identity.MAP_FILE.exists()
