# Ports

All ports bind to `127.0.0.1` only and are overridable via environment
variables. Production (Docker) uses the defaults; a local dev instance shifts
them (see [local-development.md](local-development.md)).

| Port | What | Why | Override |
|------|------|-----|----------|
| 8765 | HTTP API + dashboard | The daemon: transcript queue for the hooks (`/drain`), live activity (`/activity`), status (`/status`), and it serves the dashboard UI | `NOISY_CODING_LISTENER_PORT` |
| 8766 | WebSocket tab-audio bridge | Streams mic frames from / speaker audio to the dashboard browser tab. Do not probe it with raw TCP — a bare connect dumps handshake tracebacks into the logs | none — always the HTTP port + 1 (8765→8766, dev 7765→7766) |
| 8767 | MCP endpoint | `speak`, `announce`, `change_voice`, `list_voices` for agents, over streamable HTTP (a plain GET answers `406` — that is healthy; MCP requires `Accept: text/event-stream`) | `NOISY_CODING_MCP_PORT` |

Dev-instance convention: 7765 (HTTP) → 7766 (bridge, automatic), MCP in stdio
mode instead of a port.
