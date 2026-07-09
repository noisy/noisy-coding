---
name: grok-voice-setup
description: Set up the grok-voice voice-conversation system in this Claude Code agent — register the MCP server and hooks so the user can talk to Claude by voice. Use when the user asks to install / configure / enable grok-voice (or "voice mode") in a new agent, thread, or Claude instance (e.g. their personal Claude), or says voice isn't set up here yet.
---

# grok-voice setup

Configure this Claude Code agent for hands-free voice conversation. The repo is
at `~/Developer/grok-voice-mcp` (adjust if elsewhere). One MCP server auto-spawns
the listener daemon, so there is nothing else to keep running.

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
   replace). Use the `update-config` skill for safe merging. The exact JSON and
   script paths are in `<repo>/SETUP.md` — read it and apply verbatim, fixing
   `/path/to/grok-voice-mcp` to the real path.

4. **Tell the user to restart** — `/mcp` reconnect or relaunch Claude Code. The
   daemon spawns automatically on the first `speak`; no manual daemon start.

## Notes

- The server adopts a daemon that is already running (dev workflow) and spawns
  one otherwise (daily use). `GROK_VOICE_NO_AUTOSPAWN=1` opts out of spawning.
- For behavior once running (speak conventions, [VOICE]/[CHARACTER] handling),
  that's the separate `grok-voice` skill, not this one.
- Two agents at once: enable the MCP server only in the agent you're talking to;
  disable in the other. Full multi-agent routing is on the roadmap.
- Authoritative details live in `<repo>/SETUP.md` and `<repo>/HANDOFF.md`.
