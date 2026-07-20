---
name: after-production-release
description: What to tell the user right after publishing a noisy-coding release — derive the minimal refresh steps (image? plugin? per-session reloads?) from what actually changed and present them as a short spoken summary plus a bulleted console checklist. Use every time a release/tag is pushed, when the user asks "what do I need to do now?", or after the Docker image lands on the Hub.
---

# After a production release: tell the user exactly how to refresh

Every release ends with the same user question: *"co muszę teraz zrobić?"*
Sometimes it is one step, sometimes three — never make the user derive it.
After the image lands on Docker Hub (verify — don't announce before the
build is green), ALWAYS deliver:

1. **aloud**: one sentence naming the release and how many steps it costs
   ("dwa siedem siedem — jedna komenda, tylko kontener");
2. **in the console**: a numbered checklist of ONLY the required steps, in
   order, with nothing optional mixed in.

## Deriving the steps — look at what the release actually changed

| Changed in this release | Required step |
|---|---|
| `src/noisy_coding/**`, `Dockerfile`, `dashboard/**` | **container**: `/noisy-coding:update` once, any production thread (pulls, quotes Highlights, recreates; volume/key survives) |
| `hooks/**`, `commands/**`, `skills/**`, `.claude-plugin/**` (plugin payload) | **plugin**: `claude plugin update noisy-coding@noisy` — ONCE PER PROFILE (work + `CLAUDE_CONFIG_DIR=~/.claude-personal` for personal) |
| plugin payload (as above) | **reload**: `/reload-plugins` (or restart) IN EVERY LIVE SESSION — sessions opened after the update pick it up themselves |

Compose the checklist from the rows that apply. Common shapes:

- **Image-only** (daemon/server/dashboard fix): 1 step — `/noisy-coding:update`.
- **Plugin-only** (hooks/commands/skills): 2 steps × profiles — plugin update per profile, reload per session. No container touch.
- **Both halves** (e.g. a fix spanning mcp_exec.sh AND server.py): 3 steps — plugin update per profile → reloads → `/noisy-coding:update`. Say explicitly that ONE half alone leaves the bug alive (see the 2.7.6 lesson: container on 2.7.6 with plugins on 2.7.5 still misroutes).

## Gotchas to mention when relevant

- The marketplace has no build step — the new plugin version is available
  the second the bump lands on `main`. If `plugin update` still fetches the
  old one, it is the local catalog cache: retry in a moment. Check ground
  truth with `curl -s https://raw.githubusercontent.com/noisy/noisy-coding/main/.claude-plugin/plugin.json | grep version`.
- The Docker image DOES take ~3–4 min after the tag — never announce the
  update instructions before the release workflow is green and the tag
  shows on Docker Hub.
- The dev instance is separate: restart `scripts/dev_daemon.sh` for daemon
  changes, `npm run build` + tab reload for dashboard changes — only when
  the user is actively using dev.

## Example console block (2.7.7, image-only)

```
Po release 2.7.7 — do odświeżenia:
1. /noisy-coding:update  (dowolny produkcyjny wątek; pluginów nie ruszasz)
Gotowe — fix był tylko w obrazie.
```
