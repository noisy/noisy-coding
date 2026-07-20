# noisy-coding — agent notes

Voice coding for Claude Code: a daemon (production runs in Docker) plus Claude
Code hooks and an MCP server. Python backend in `src/noisy_coding/`, Vue
dashboard in `dashboard/`, hooks in `hooks/`.

## Local development setup

Follow `docs/local-development.md` — do not improvise. In short: production
owns ports 8765–8767; the dev instance from this checkout runs on 7765
(`scripts/dev_daemon.sh`). Wiring a session to dev means BOTH:

1. a second MCP server named `noisy-coding-dev` (stdio, LOCAL scope — one
   `claude mcp add --scope local` per machine; NEVER commit it to a
   `.mcp.json`, the plugin auto-ships that file to end users), and
2. project-scoped hook overrides in this repo's `.claude/settings.json`
   pointing at local `hooks/*.py` with `NOISY_CODING_LISTENER_PORT=7765`.
   These DUPLICATE the global docker-exec hooks on purpose — global ones
   keep serving production, project ones serve dev.

## Key docs

- `docs/hooks.md` — the five hooks, why each exists, registration paths
- `docs/ports.md` — what each port is for
- `docs/local-development.md` — dev instance next to production
