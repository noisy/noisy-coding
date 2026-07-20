"""The shell launchers (hooks/exec.sh, hooks/mcp_exec.sh) carry real logic:
title extraction, the rewake exit-code contract, waiting out the container.
They are tested by running the actual scripts with a FAKE `docker` first on
PATH — the fake records its argv/stdin to a file and plays whatever behavior
the test scripted, so every branch is assertable without Docker."""

import json
import os
import stat
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXEC_SH = REPO / "hooks" / "exec.sh"
MCP_EXEC_SH = REPO / "hooks" / "mcp_exec.sh"


def fake_docker(tmp_path, script_body):
    """Install a fake `docker` on PATH that logs each call and runs script_body."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    log = tmp_path / "docker-calls.log"
    fake = bin_dir / "docker"
    fake.write_text(
        "#!/bin/sh\n"
        f'echo "$@" >> "{log}"\n'
        f'STDIN=$(cat)\n'
        f'printf %s "$STDIN" > "{tmp_path}/docker-stdin.txt"\n'
        + script_body
        + "\n"
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    env = dict(os.environ, PATH=f"{bin_dir}:{os.environ['PATH']}")
    return env, log


def run(script, args, stdin, env):
    return subprocess.run(
        ["sh", str(script), *args],
        input=stdin, capture_output=True, text=True, env=env, timeout=30,
    )


def test_exec_sh_passes_the_session_title_extracted_host_side(tmp_path):
    transcript = tmp_path / "transcript.jsonl"
    transcript.write_text(
        '{"customTitle": "old-name"}\n{"customTitle": "release"}\n'
    )
    env, log = fake_docker(tmp_path, "exit 0")
    hook_input = json.dumps({"transcript_path": str(transcript)})

    run(EXEC_SH, ["stop.py"], hook_input, env)

    call = log.read_text()
    assert "NOISY_CODING_SESSION_TITLE=release" in call  # last title wins
    assert "/app/hooks/stop.py" in call
    # The hook input must be forwarded untouched.
    assert json.loads((tmp_path / "docker-stdin.txt").read_text()) == {
        "transcript_path": str(transcript)
    }


def test_exec_sh_sends_an_empty_title_when_the_transcript_is_unreadable(tmp_path):
    env, log = fake_docker(tmp_path, "exit 0")

    run(EXEC_SH, ["stop.py"], '{"transcript_path": "/nope/missing.jsonl"}', env)

    assert "NOISY_CODING_SESSION_TITLE= " in log.read_text()


def test_exec_sh_preserves_the_rewake_contract(tmp_path):
    # Exit code 2 + transcript on stderr is what wakes the model; exec.sh
    # must pass BOTH through even though it captures output for filtering.
    env, _ = fake_docker(tmp_path, 'echo "[VOICE] wake up"; exit 2')

    result = run(EXEC_SH, ["stop.py"], "{}", env)

    assert result.returncode == 2
    assert "[VOICE] wake up" in result.stderr


def test_exec_sh_is_silent_on_docker_failure(tmp_path):
    # Container missing/stopped: no output, exit 0 — hooks must never spam.
    env, _ = fake_docker(tmp_path, 'echo "No such container" >&2; exit 1')

    result = run(EXEC_SH, ["stop.py"], "{}", env)

    assert result.returncode == 0
    assert result.stdout == ""
    assert result.stderr == ""


def test_mcp_exec_waits_for_the_container_then_execs_stdio(tmp_path):
    # First two probes fail (container still starting), third succeeds.
    counter = tmp_path / "count"
    env, log = fake_docker(
        tmp_path,
        f'N=$(cat "{counter}" 2>/dev/null || echo 0); N=$((N+1)); echo $N > "{counter}"\n'
        'if [ "$N" -lt 3 ]; then exit 1; fi\n'
        'echo "mcp-started"; exit 0',
    )

    result = run(MCP_EXEC_SH, [], "", env)

    assert result.returncode == 0
    assert "mcp-started" in result.stdout
    calls = log.read_text().splitlines()
    assert len(calls) >= 3  # it kept retrying instead of dying on the first refusal
    # The MCP instance must be forced to stdio (the image env says http).
    assert "NOISY_CODING_MCP_TRANSPORT=stdio" in calls[-1]
    assert "noisy-coding-mcp" in calls[-1]
