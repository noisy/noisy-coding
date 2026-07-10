#!/usr/bin/env python3
"""PostToolUse hook: deliver queued voice transcripts to the model mid-work.

Fails open (silent exit) whenever the listener daemon is not running.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _agent_identity import identity  # noqa: E402

PORT = os.environ.get("GROK_VOICE_LISTENER_PORT", "8765")


def main() -> None:
    raw = sys.stdin.read()
    try:
        hook_input = json.loads(raw) if raw.strip() else {}
    except ValueError:
        hook_input = {}
    agent, _label = identity(hook_input)
    drain_url = f"http://127.0.0.1:{PORT}/drain?agent={agent}"
    try:
        with urllib.request.urlopen(drain_url, timeout=0.5) as response:
            transcripts = json.load(response)["transcripts"]
    except Exception:
        return
    if not transcripts:
        return

    spoken = " ".join(t["text"] for t in transcripts)
    print(
        json.dumps(
            {
                "systemMessage": f"🎙️ Voice: „{spoken}”",
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": (
                        f"[VOICE] The user just said (spoken, while you work): {spoken}\n"
                        "If this asks you to stop or change course, do so now; "
                        "otherwise incorporate it and continue."
                    ),
                }
            }
        )
    )


if __name__ == "__main__":
    main()
