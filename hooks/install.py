#!/usr/bin/env python3
"""One-shot hook installer.

Local checkout:   python3 hooks/install.py
No clone at all:  docker run --rm -v ~/.claude:/root/.claude \
                    noisy/noisy-coding python3 /app/hooks/install.py --docker

Registers the noisy-coding hooks in ~/.claude/settings.json (user scope).
Default mode points at THIS checkout with the plain `python3` from PATH
(every hook is stdlib-only, python 3.9+). --docker mode writes `docker
exec` commands instead — the hooks run inside the long-lived noisy-coding
container, so the host needs no python at all (Windows included); env is
passed with -e, never POSIX VAR=… prefixes, so the commands survive
cmd/PowerShell. Idempotent: existing noisy-coding entries are replaced in
place, everything else in the file is preserved. Restart Claude Code (or
/mcp reconnect) afterwards.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
SETTINGS = Path.home() / ".claude" / "settings.json"
DOCKER_MODE = "--docker" in sys.argv


def _command(script: str, env: str = "") -> dict:
    if DOCKER_MODE:
        env_flag = f"-e {env} " if env else ""
        command = f"docker exec -i {env_flag}noisy-coding python3 /app/hooks/{script}"
    else:
        prefix = f"{env} " if env else ""
        command = f"{prefix}python3 {HOOKS_DIR / script}"
    return {"type": "command", "command": command, "timeout": 5}


def _entries() -> dict:
    stop = _command("stop.py")
    # The rewake poller listens for your voice long after the turn ends —
    # its timeout must outlive the poll window (60 min + slack).
    stop["timeout"] = 3630
    stop["asyncRewake"] = True
    stop["statusMessage"] = "Listening for your voice"
    # Shown in the console when the poller wakes the model — without it the
    # harness prints a cryptic default ("Stop hook feedback").
    stop["rewakeSummary"] = "🎙️ Voice message received"
    return {
        "UserPromptSubmit": [{"hooks": [_command("user_prompt_submit.py")]}],
        "PreToolUse": [
            {"matcher": "mcp__noisy-coding__speak", "hooks": [_command("pre_speak.py")]},
            {"matcher": "*", "hooks": [_command("pre_tool_use.py")]},
        ],
        "PostToolUse": [{"matcher": "*", "hooks": [_command("post_tool_use.py")]}],
        "Stop": [{"hooks": [stop]}],
    }


def _is_ours(entry: dict) -> bool:
    return any(
        "noisy-coding" in hook.get("command", "") or str(HOOKS_DIR) in hook.get("command", "")
        for hook in entry.get("hooks", [])
    )


def main() -> None:
    settings: dict = {}
    if SETTINGS.exists():
        settings = json.loads(SETTINGS.read_text() or "{}")
    hooks = settings.setdefault("hooks", {})
    for event, ours in _entries().items():
        kept = [e for e in hooks.get(event, []) if not _is_ours(e)]
        hooks[event] = kept + ours
    SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + "\n")
    print(f"noisy-coding hooks registered in {SETTINGS}")
    print("Restart Claude Code (or /mcp reconnect) to activate them.")


if __name__ == "__main__":
    main()
