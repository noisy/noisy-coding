#!/usr/bin/env python3
"""PostToolUse hook: deliver queued voice transcripts to the model mid-work.

Stdlib only — runs on system python3 with no venv so it adds ~30ms per tool
call. Fails open (silent exit) whenever the listener daemon is not running.
"""

import json
import os
import sys
import urllib.request

PORT = os.environ.get("GROK_VOICE_LISTENER_PORT", "8765")
DRAIN_URL = f"http://127.0.0.1:{PORT}/drain"


def main() -> None:
    sys.stdin.read()
    try:
        with urllib.request.urlopen(DRAIN_URL, timeout=0.5) as response:
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
