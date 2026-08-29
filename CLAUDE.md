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

## Releasing

Run `python3 scripts/bump_version.py X.Y.Z` - it bumps all four version
files AND prints the release checklist. Follow it to the letter; the one
step agents keep forgetting: **auto-generated release notes only list PRs
and miss direct commits - always write real notes** (highlights for
humans) and publish with `gh release edit vX.Y.Z --notes-file ... --draft=false`,
then verify the GitHub release and the Docker image manifest.

Deploying to the local prod container is part of the release:

    docker compose pull && docker compose up -d
    curl -s http://127.0.0.1:8765/status | grep -o '"version": "[^"]*"'

The curl MUST report the version just released - `up -d` alone proves
nothing. docker-compose.yml runs the PUBLISHED image; never point it at
`build:` (a stale local build once shadowed a release as 2.13.4) - the
working tree runs via docker-compose.dev.yml under a distinct name.

## Restarting the daemon

Never `kill` it. Use the graceful path, and **always sixty seconds**:

    curl -X POST http://127.0.0.1:7765/shutdown -d '{"delay_seconds":60}'

The dashboard shows a countdown with CANCEL and RESTART NOW, and the daemon
refuses to die mid-recording. Sixty is not negotiable downwards: a shorter
countdown is not enough warning to finish a thought, and Krzysztof can
always hit RESTART NOW to go faster. The delay exists for him, not for us.

## Frontend changes

New UI (a widget, banner, layout, any new look) is designed in Storybook
FIRST - present several variants (3-5) as *.stories.ts and let Krzysztof
pick before wiring anything into the app. Only trivially-derivative
changes (same pattern as an existing element) may skip this.

**And Storybook is kept up to date afterwards.** It is the reference for
what the UI does, not a scratchpad from when a component was designed:

- change a component's behaviour, update its stories in the same commit
- a bug worth fixing is a state worth a story - regressions belong where
  they can be seen, not only in a spec
- delete stories for things that no longer exist (git remembers them);
  stale variants cost more than they save, because someone will judge a
  change against a story that no longer describes the product
- cover the parts, not just the assembled whole - a component in isolation
  is where a change usually breaks first
