---
name: clean-install-reset
description: Wipe noisy-coding leftovers from this machine so the install path can be tested from scratch — hooks, MCP entries, plugin/marketplace remnants, config, optionally the Docker volume. Use when the user wants to test a clean/fresh installation, reset the setup, or hunt down stale noisy-coding (or legacy grok-voice) artifacts. Repo-local skill: guides an interactive audit, never a blind delete.
---

# Clean-slate reset for install testing

Purpose: bring the machine to the state of a NEW user, so the plugin install
path (`marketplace add` → `plugin install` → `/noisy-coding:setup`) can be
tested honestly. This skill is a checklist and a conversation script, not a
delete script — AUDIT first, show the user a table of findings, ASK about the
destructive choices, and back up whatever you edit (one local directory,
e.g. `.cleanup-backup-<date>/`, kept out of git).

Expect the permission classifier to block some steps (editing settings files
from scripts, `docker rm`): fall back to the Edit tool for files, and hand the
user a ready `!`-prefixed command for the docker parts.

## Where artifacts hide (audit ALL of these)

1. `~/.claude/settings.json` — installer-era hooks (`docker exec -i
   noisy-coding …`) and `enabledPlugins` / `extraKnownMarketplaces` entries.
2. `~/.claude.json` — a user-scope `mcpServers.noisy-coding` entry (from the
   manual `claude mcp add` path) and dead `projects` entries (e.g. the old
   `grok-voice-mcp` checkout).
3. `~/.claude/plugins/` — `installed_plugins.json`, `known_marketplaces.json`
   (marketplace `noisy`), `cache/noisy/`. Prefer `claude plugin uninstall` /
   `claude plugin marketplace remove` over hand-editing when available.
4. Plugin hooks live inside the plugin cache — they vanish with the plugin;
   no separate cleanup, but VERIFY nothing noisy-related remains in the main
   settings afterwards (`grep -i noisy ~/.claude/settings.json`).
5. `~/.claude/skills/` — hand-copied `grok-voice*` relics.
6. `~/.config/noisy-coding/` — stale `rewake-*.lock` files and `sessions.json`
   are always safe to delete; `credentials.json`, `history.json`,
   `character.json`, `settings.json` are USER DATA — ask (see below).
7. `~/.config/grok-voice/` — pre-rename leftovers, safe to delete.
8. Docker: container `noisy-coding`, volume `noisy-coding-config`, legacy
   images (`grok-voice*`, old `noisy/noisy-coding`). `docker rm` needs the
   user; give the exact command.
9. Secondary Claude profiles the user may have (e.g. `~/.claude-personal`) —
   same checks as 1–3. Ask which profiles are in scope.

## The two questions that MUST be asked, with consequences

- **"Wipe the Docker volume (`noisy-coding-config`)?"** Deleting it erases
  the container-side API key, conversation history and settings — the test
  then covers the full first-contact flow including pasting the key in the
  dashboard. Keeping it tests the returning-user flow (key survives). Both
  are worth testing at times; the user picks per run.
- **"Wipe host config (`~/.config/noisy-coding`) data files?"** Same trade-off
  for local/dev daemons: key + history + voice settings are lost. Locks and
  sessions.json are exempt — clean those without asking.

Also ask about anything ambiguous you find (e.g. `~/.zshrc` blocks mentioning
grok may belong to xAI's CLI, not this project — flag, don't touch).

## After the reset

Sanity: `grep -i "noisy\|grok" ~/.claude/settings.json ~/.claude.json` should
come back empty (modulo unrelated matches), `claude plugin list` shows no
noisy-coding, `docker ps -a` no container. Then hand the user back to the
README quick start and observe the fresh install like a new user would.
