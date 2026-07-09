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
# "sync": block the turn end via stdout JSON while polling (documented path).
# "rewake": run as an asyncRewake background hook — poll long, then exit(2)
# with the transcript on stderr to wake the model.
MODE = os.environ.get("GROK_VOICE_STOP_MODE", "sync")
REWAKE_WAIT_SECONDS = float(os.environ.get("GROK_VOICE_REWAKE_WAIT_SECONDS", "300"))


def _get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=0.5) as response:
        return json.load(response)


def _wait_seconds() -> float:
    status = _get("/status")
    voice_recently_used = (
        time.time() - status.get("last_transcript_at", 0) < VOICE_ACTIVE_WINDOW_SECONDS
    )
    return LONG_WAIT_SECONDS if voice_recently_used else SHORT_WAIT_SECONDS


def _poll_for_speech(wait_seconds: float) -> str | None:
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        transcripts = _get("/drain")["transcripts"]
        if transcripts:
            return " ".join(t["text"] for t in transcripts)
        time.sleep(POLL_INTERVAL_SECONDS)
    return None


VOICE_INSTRUCTION = (
    "Treat this as his next message. Answer it now — aloud via the "
    "grok-voice speak tool (briefly) and in text."
)


def main() -> None:
    sys.stdin.read()
    try:
        if MODE == "rewake":
            spoken = _poll_for_speech(REWAKE_WAIT_SECONDS)
            if spoken:
                print(
                    f"[VOICE] Krzysztof said (spoken): {spoken}\n{VOICE_INSTRUCTION}",
                    file=sys.stderr,
                )
                sys.exit(2)
            return
        spoken = _poll_for_speech(_wait_seconds())
        if spoken:
            print(
                json.dumps(
                    {
                        "decision": "block",
                        "reason": f"[VOICE] Krzysztof said (spoken): {spoken}\n{VOICE_INSTRUCTION}",
                    }
                )
            )
    except Exception:
        return


if __name__ == "__main__":
    main()
