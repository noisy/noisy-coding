# grok-voice-mcp — setup in a new Claude Code agent

Get voice conversation working in any Claude Code instance (e.g. a personal
Claude alongside your work one). One MCP server does it all — it auto-spawns
the listener daemon, so there is no separate process to babysit.

## 1. Register the MCP server (user scope)

```bash
claude mcp add grok-voice --scope user \
  -e XAI_API_KEY=xai-... \
  -e GROK_VOICE_DEFAULT_VOICE=carina \
  -e GROK_VOICE_DEFAULT_LANGUAGE=auto \
  -e GROK_VOICE_STT_LANGUAGE=pl \
  -- uv run --project /path/to/grok-voice-mcp grok-voice-mcp
```

On first `speak`, the server checks `127.0.0.1:8765`: if nothing is there it
spawns the listener daemon as a child process (mic → STT → queue); if a daemon
is already running it adopts it. The child dies with the server, so closing the
agent leaves no orphan daemon.

## 2. Register the hooks (so the agent hears you)

The server speaks on its own, but hearing you needs three hooks in
`~/.claude/settings.json` (they poll the daemon's queue). Merge this into the
`hooks` block — see `hooks/` in the repo for the scripts:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "mcp__grok-voice__speak",
      "hooks": [{ "type": "command", "command": "python3 /path/to/grok-voice-mcp/hooks/pre_speak.py", "timeout": 5 }] }],
    "PostToolUse": [{ "matcher": "*",
      "hooks": [{ "type": "command", "command": "python3 /path/to/grok-voice-mcp/hooks/post_tool_use.py", "timeout": 5 }] }],
    "Stop": [{ "hooks": [{ "type": "command",
      "command": "GROK_VOICE_STOP_MODE=rewake python3 /path/to/grok-voice-mcp/hooks/stop.py",
      "timeout": 3660, "asyncRewake": true }] }]
  }
}
```

## 3. Restart the agent

`/mcp` reconnect (or restart Claude Code). Then just talk — the daemon is up,
the hooks deliver your speech, and `speak` answers aloud.

## Running two agents (work + personal)

Only one agent should own the mic-to-conversation link at a time. Simplest:
keep the grok-voice MCP server enabled only in the agent you're talking to, and
disabled in the other. Switching = enable there, disable here, `/mcp` reconnect.
(True multi-agent routing — several agents on one daemon — is on the roadmap.)

## Development vs daily use

- **Daily:** do nothing extra. The server spawns the daemon for you.
- **Development (iterating on the daemon):** start the daemon by hand first —
  `uv run grok-voice-listener`. The server then adopts it instead of spawning,
  so you can restart the daemon in place without touching the MCP server.
  (Or set `GROK_VOICE_NO_AUTOSPAWN=1` to always manage it yourself.)
