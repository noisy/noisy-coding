# Running a local dev instance next to production

The production Noisy Studio lives in a Docker container and owns the default
ports (8765 HTTP/dashboard, 8766 WS bridge, 8767 MCP). A development instance
runs straight from this checkout on shifted ports, so both answer at the same
time: your other projects keep talking to production while sessions in this
repo talk to the code you are editing.

## 1. Start the dev daemon

```sh
scripts/dev_daemon.sh
```

This builds the dashboard once (if `dashboard/dist` is missing) and starts the
listener on **7765** (WS bridge follows on 7766). The dashboard lives at
<http://127.0.0.1:7765> — it shows an amber logo and a **LOCAL DEV** badge, so
it can never be confused with the blue production dashboard. Everything else
looks production-identical on purpose: the dev instance is where production
visuals get tested.

Port taken? `NOISY_CODING_DEV_HTTP_PORT=7775 scripts/dev_daemon.sh`.

### Separate config dir — mandatory

A dev install MUST use its own config directory, never the production one.
`scripts/dev_daemon.sh` sets `NOISY_CODING_CONFIG_DIR` to
`~/.config/noisy-coding-dev` (override with `NOISY_CODING_DEV_CONFIG_DIR`),
so the dev daemon keeps its OWN history, conversations, settings and voice
claims. Production (the native app) uses the default `~/.config/noisy-coding`.

This is not optional polish. The config dir holds every persistent file,
and two daemons pointed at one dir fight over it - last writer wins, so a
dev session's tabs and history bleed into production and vice versa, and a
"clear history" on one is undone by the other. The split must be on disk,
not merely on ports.

The MCP server and the hooks are config-dir-agnostic - they reach the
daemon by port and carry no persistent state - so ONLY the daemon needs
the env var. On first run `dev_daemon.sh` seeds the new dev dir with just
`credentials.json` and `providers.json` copied from production, so voice
works without a re-setup; everything else starts empty.

## 2. Point sessions in this repo at the dev instance

Two integration points, both scoped to this repo so nothing else changes:

**MCP** — register a separate, unmistakably-named server (stdio, LOCAL
scope), so an agent can never confuse the two:

```sh
claude mcp add noisy-coding-dev --scope local \
  --env NOISY_CODING_LISTENER_PORT=7765 \
  -- uv run noisy-coding-mcp
```

Local scope (per user, per project — stored in `~/.claude.json`) is
deliberate: the repo root doubles as the PLUGIN root, and any `.mcp.json`
committed here is auto-loaded by the plugin and shipped to every end user
(that bug shipped in 2.7.0–2.7.3). One command per contributor machine is
the price of never leaking the dev server again.

Production stays `noisy-coding`; the dev tools show up as
`mcp__noisy-coding-dev__*`.

**Hooks** — production hooks run via `docker exec` inside the container and
always reach the production daemon. Override them per project in this repo's
`.claude/settings.json` with local commands that carry the dev port, e.g.:

```json
{
  "hooks": {
    "Stop": [{"hooks": [{
      "type": "command",
      "command": "NOISY_CODING_LISTENER_PORT=7765 python3 hooks/stop.py",
      "timeout": 3630, "asyncRewake": true
    }]}]
  }
}
```

(Repeat the pattern for the other four hooks — see `docs/hooks.md` for the
full list. Project hooks run in addition to the global ones, so expect the
production registration to keep firing too; that is harmless — each talks to
its own daemon.)

## 3. Both at once, without confusion

- **Dashboards**: one browser tab per instance; each tab arms its own audio.
  Prod is blue, dev is amber-badged.
- **Rewake locks**: production's live inside the container
  (`/root/.config/noisy-coding`), dev's on the host — no collision.
- **Naming**: `noisy-coding` = production, `noisy-coding-dev` = this checkout.
  Never rename production.

## Iterating

- Python changes: restart `scripts/dev_daemon.sh` (it runs `uv run` against
  the checkout).
- Dashboard changes: `cd dashboard && npm run build`, then reload the tab —
  or `npm run dev` for Vite hot-reload against the dev daemon.
