#!/usr/bin/env python3
"""One-shot hook installer: python3 hooks/install.py

Registers the grok-voice hooks in ~/.claude/settings.json (user scope),
pointing at THIS checkout with the plain `python3` from PATH — every hook
is stdlib-only and runs on python 3.9+. Idempotent: existing grok-voice
entries are replaced in place, everything else in the file is preserved.
Restart Claude Code (or /mcp reconnect) afterwards.
"""

from __future__ import annotations

import json
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
SETTINGS = Path.home() / ".claude" / "settings.json"


def _command(script: str, env: str = "") -> dict:
    prefix = f"{env} " if env else ""
    return {
        "type": "command",
        "command": f"{prefix}python3 {HOOKS_DIR / script}",
        "timeout": 5,
    }


def _entries() -> dict:
    stop = _command("stop.py", env="GROK_VOICE_STOP_MODE=rewake")
    # The rewake poller listens for your voice long after the turn ends —
    # its timeout must outlive the poll window (30 min + slack).
    stop["timeout"] = 1830
    stop["asyncRewake"] = True
    stop["statusMessage"] = "Listening for your voice"
    return {
        "UserPromptSubmit": [{"hooks": [_command("user_prompt_submit.py")]}],
        "PreToolUse": [
            {"matcher": "mcp__grok-voice__speak", "hooks": [_command("pre_speak.py")]},
            {"matcher": "*", "hooks": [_command("pre_tool_use.py")]},
        ],
        "PostToolUse": [{"matcher": "*", "hooks": [_command("post_tool_use.py")]}],
        "Stop": [{"hooks": [stop]}],
    }


def _is_ours(entry: dict) -> bool:
    return any(
        "grok-voice" in hook.get("command", "") or str(HOOKS_DIR) in hook.get("command", "")
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
    print(f"grok-voice hooks registered in {SETTINGS}")
    print("Restart Claude Code (or /mcp reconnect) to activate them.")


if __name__ == "__main__":
    main()
