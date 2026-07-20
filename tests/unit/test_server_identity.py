import json

from noisy_coding import server


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
