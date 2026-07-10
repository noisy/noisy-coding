---
name: grok-voice-setup
description: Set up the grok-voice voice-conversation system in this Claude Code agent — register the MCP server and hooks so the user can talk to Claude by voice. Use when the user asks to install / configure / enable grok-voice (or "voice mode") in a new agent, thread, or Claude instance (e.g. their personal Claude), or says voice isn't set up here yet.
---

# grok-voice setup

Configure this Claude Code agent for hands-free voice conversation. The repo is
at `~/Developer/grok-voice-mcp` (adjust if elsewhere). One MCP server auto-spawns
the listener daemon, so there is nothing else to keep running. Multiple agents
can share one daemon/mic and are switched from the dashboard.

## Steps

1. **Confirm the repo path and API key.** Ask the user for their xAI API key if
   not already known. Default repo path: `~/Developer/grok-voice-mcp`.

2. **Register the MCP server (user scope):**
   ```bash
   claude mcp add grok-voice --scope user \
     -e XAI_API_KEY=<key> \
     -e GROK_VOICE_DEFAULT_VOICE=carina \
     -e GROK_VOICE_DEFAULT_LANGUAGE=auto \
     -e GROK_VOICE_STT_LANGUAGE=pl \
     -- uv run --project <repo> grok-voice-mcp
   ```

3. **Register the three hooks** in `~/.claude/settings.json` (merge, don't
   replace) — see `<repo>/SETUP.md` for the exact JSON, apply verbatim fixing
   `/path/to/grok-voice-mcp`. TWO things that WILL break it if you get them wrong:
   - **Use `<repo>/.venv/bin/python3`, NOT bare `python3`.** macOS system python3
     is often 3.9; the hooks use 3.10+ syntax and the Stop hook crashes silently
     on 3.9, so idle speech never gets delivered.
   - **Agent name is optional now.** Leave `GROK_VOICE_AGENT_NAME` OUT and each
     Claude session self-registers by its session id (label = its /rename title)
     — good for running several sessions of one Claude. Only set an explicit
     `GROK_VOICE_AGENT_NAME=<name>` in every hook command if you want a fixed
     name across restarts (e.g. separate work vs personal Claude configs).

4. **Tell the user to restart** — `/mcp` reconnect or relaunch Claude Code. The
   daemon spawns automatically on the first `speak`; no manual daemon start.

## Notes

- The server adopts a running daemon (dev workflow) and spawns one otherwise
  (daily use). `GROK_VOICE_NO_AUTOSPAWN=1` opts out of spawning.
- Multi-agent: several agents share one daemon/mic; the daemon routes speech to
  the ACTIVE agent only. Switch the active agent from the dashboard tabs
  (`http://127.0.0.1:8765`) or the mobile page (`grok-voice-mobile` + ngrok).
- For behavior once running (speak conventions, [VOICE]/[CHARACTER] handling),
  that's the separate `grok-voice` skill, not this one.
- Authoritative details live in `<repo>/SETUP.md` and `<repo>/HANDOFF.md`.
