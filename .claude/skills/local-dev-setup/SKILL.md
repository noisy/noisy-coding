---
name: local-dev-setup
description: Set up or fix the side-by-side LOCAL DEV instance of noisy-coding in this repo — dev daemon on port 7765, noisy-coding-dev MCP, project-scoped hooks. Use when asked to prepare the local development environment, when the dev daemon is down, or when a session in this repo should talk to the dev instance instead of production.
---

# Local dev environment for noisy-coding contributors

This skill lives in `.claude/skills/` — project scope, for people hacking on
THIS repo. It is deliberately NOT in the plugin's `skills/` directory, so it
never ships to end users.

The full recipe with rationale is `docs/local-development.md` — read it when
anything here surprises you. Quick path:

## 1. Dev daemon (port 7765; production keeps 8765–8767)

```sh
scripts/dev_daemon.sh
```

Builds the dashboard if `dashboard/dist` is missing, then starts the listener
from this checkout. Verify: `curl -s http://127.0.0.1:7765/status` returns
JSON. Dashboard: <http://127.0.0.1:7765> — amber logo + LOCAL DEV badge.

Run it in the background (`run_in_background`) and restart it after changing
Python code; rebuild (`cd dashboard && npm run build`) after dashboard changes.

## 2. Session wiring — should already be in place

- MCP is per contributor machine (LOCAL scope — a committed `.mcp.json`
  would be auto-loaded by the plugin and leak the dev server to end users):

  ```sh
  claude mcp add noisy-coding-dev --scope local \
    --env NOISY_CODING_LISTENER_PORT=7765 -- uv run noisy-coding-mcp
  ```

  Tools appear as `mcp__noisy-coding-dev__*` after a restart.
- Hooks are committed to this repo, so normally there is nothing to do:
  `.claude/settings.json` → the five hooks duplicated with local commands
  (`NOISY_CODING_LISTENER_PORT=7765 python3 hooks/<script>.py`). They run IN
  ADDITION to the global production hooks — that is intended; each set talks
  to its own daemon.

If either is missing, restore it from `docs/local-development.md` §2.

## Verify against the DAEMON, not just Vite

Vite serves `public/` and its own module graph, masking daemon-side
gaps: the avatars sprite worked on :5173 for hours while the container
404'd it (the daemon's static route didn't know the file). Any change
involving static files, routes or daemon-served behavior must be checked
on the daemon port (7765 dev / 8765 prod build) — ideally with a
headless-Chrome screenshot — before calling it done.

## 3. Sanity checks / gotchas

- Speak through dev with `mcp__noisy-coding-dev__speak`, through production
  with `mcp__noisy-coding__speak` — never assume they are the same daemon.
- Dev reads the HOST config (`~/.config/noisy-coding`): shared API key, but
  its own voice/settings; production reads the container volume.
- With both mics live the user's speech arrives TWICE (once per daemon) —
  treat the second copy as a duplicate, and suggest muting one dashboard.
- Rewake locks do not collide (host vs container) — see docs/hooks.md.
