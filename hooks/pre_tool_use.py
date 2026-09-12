#!/usr/bin/env python3
"""PreToolUse hook (all tools): report live activity to the dashboard.

Fires when a tool STARTS — the busy bubble shows what Claude is doing at
this very moment. Its counterpart in post_tool_use.py flips the line to
THINKING… once the tool finishes and the model is reasoning again.
Fails open; never blocks the tool call.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _agent_identity import identity  # noqa: E402
from post_tool_use import _activity_line, _post_activity  # noqa: E402


def main() -> None:
    raw = sys.stdin.read()
    try:
        hook_input = json.loads(raw) if raw.strip() else {}
    except ValueError:
        return
    agent, _label = identity(hook_input)
    line = _activity_line(hook_input)
    if line:
        _post_activity(agent, line)


if __name__ == "__main__":
    main()
