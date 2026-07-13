#!/usr/bin/env python3
"""UserPromptSubmit hook: light the activity line the moment a turn begins.

Tool hooks only fire around tool calls, so a turn that OPENS with a long
reasoning stretch showed no activity at all — the dashboard's busy bubble
appeared only at the first tool, leaving AWAITING transcripts unexplained.
The model is thinking from the first token; say so.
Fails open (silent exit) whenever the listener daemon is not running.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _agent_identity import identity  # noqa: E402
from post_tool_use import _post_activity  # noqa: E402


def main() -> None:
    raw = sys.stdin.read()
    try:
        hook_input = json.loads(raw) if raw.strip() else {}
    except ValueError:
        hook_input = {}
    agent, _label = identity(hook_input)
    _post_activity(agent, "THINKING…")


if __name__ == "__main__":
    main()
