#!/usr/bin/env python3
"""Compatibility shim -> claude_hook flow (see hooks/claude_hook.py).

The overhaul replaced the five per-event scripts with a single flow. This
shim stays so a Claude Code session that loaded the pre-overhaul config
(hooks are read once at startup) keeps working until it is restarted; new
installs register claude_hook.py directly. Remove in phase 6.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import _hook_flow
except Exception:
    sys.exit(0)


def main() -> None:
    payload = _hook_flow.read_payload()
    if not payload:
        return
    window = os.environ.get("NOISY_CODING_REWAKE_WAIT_SECONDS")
    try:
        code = _hook_flow.run(
            "claude-hooks", payload, listen_seconds=float(window) if window else None
        )
    except Exception:
        return
    if code:
        sys.exit(code)


if __name__ == "__main__":
    main()
