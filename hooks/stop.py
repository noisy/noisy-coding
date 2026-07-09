#!/usr/bin/env python3
"""Stop hook: keep a voice conversation alive across turn boundaries.

When the turn is about to end, wait a moment for Krzysztof to speak; if he
does, block the stop and hand his words to the model. The wait is long only
when voice was used recently, so keyboard-only sessions end turns instantly.
Fails open (silent exit) whenever the listener daemon is not running.
"""

import json
import os
import sys
import time
import urllib.request

PORT = os.environ.get("GROK_VOICE_LISTENER_PORT", "8765")
BASE_URL = f"http://127.0.0.1:{PORT}"
VOICE_ACTIVE_WINDOW_SECONDS = 300
LONG_WAIT_SECONDS = float(os.environ.get("GROK_VOICE_STOP_WAIT_SECONDS", "30"))
SHORT_WAIT_SECONDS = 2.0
POLL_INTERVAL_SECONDS = 0.5


def _get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=0.5) as response:
        return json.load(response)


def _wait_seconds() -> float:
    status = _get("/status")
    voice_recently_used = (
        time.time() - status.get("last_transcript_at", 0) < VOICE_ACTIVE_WINDOW_SECONDS
    )
    return LONG_WAIT_SECONDS if voice_recently_used else SHORT_WAIT_SECONDS


def main() -> None:
    sys.stdin.read()
    try:
        deadline = time.time() + _wait_seconds()
        while time.time() < deadline:
            transcripts = _get("/drain")["transcripts"]
            if transcripts:
                spoken = " ".join(t["text"] for t in transcripts)
                print(
                    json.dumps(
                        {
                            "decision": "block",
                            "reason": (
                                f"[VOICE] Krzysztof said (spoken): {spoken}\n"
                                "Treat this as his next message. Answer it now — "
                                "aloud via the grok-voice speak tool (briefly) "
                                "and in text."
                            ),
                        }
                    )
                )
                return
            time.sleep(POLL_INTERVAL_SECONDS)
    except Exception:
        return


if __name__ == "__main__":
    main()
