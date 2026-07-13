# grok-voice-mcp

Voice conversations with Claude Code. Claude speaks short summaries aloud
through your speakers, and an always-on listener daemon turns your speech into
messages Claude receives while it works — powered by the
[Grok (xAI) Voice API](https://docs.x.ai/developers/rest-api-reference/inference/voice)
and a live "tactical HUD" dashboard at <http://127.0.0.1:8765>.

## Architecture (fat daemon / thin server)

All speech logic lives in one **listener daemon** — the single owner of the
microphone, the playback queue (one voice at a time, never talking over you)
and the speakers. The MCP server is a thin messenger that forwards `speak`
requests over localhost HTTP. Claude Code hooks deliver your transcribed
speech back into the session.

```
mic -> VAD -> Grok STT -> transcript queue -> HTTP 127.0.0.1:8765
                                   ^ polled by Claude Code hooks
speak (MCP) -> POST /speak -> daemon queue -> Grok TTS -> speakers
```

## Tools

| Tool | What it does |
| --- | --- |
| `speak(text, interrupt?)` | Queues `text` for speech and waits until it has played. Voice/speed/language come from the daemon (dashboard character), not the call. |
| `announce(text)` | Fire-and-forget variant: returns immediately, plays in the background. |
| `change_voice(voice_id)` | Deliberately switches this agent's voice (persists, shows on the dashboard). |
| `list_voices()` | Lists the built-in Grok voices (`ara`, `eve`, `leo`, `rex`, …). |

## Installation

Requires Python 3.13 and [uv](https://docs.astral.sh/uv/). The xAI API key is
**not** configured anywhere in the shell — the dashboard asks for it on first
contact and stores it in `~/.config/grok-voice/credentials.json`.

### macOS

```bash
git clone <this repo> && cd grok-voice-mcp
uv sync

# 1. start the daemon (first run triggers the mic permission prompt)
uv run grok-voice-listener

# 2. register the MCP server in Claude Code
claude mcp add grok-voice --scope user \
  -- uv run --project "$PWD" grok-voice-mcp

# 3. open the dashboard and paste your xAI API key (console.x.ai)
open http://127.0.0.1:8765
```

Playback uses the built-in `afplay`; installing `mpv` or `ffplay` (optional)
enables lower-latency streaming playback.

### Linux (native)

```bash
sudo apt install libportaudio2 mpv     # PortAudio for the mic, mpv for playback
git clone <this repo> && cd grok-voice-mcp
uv sync
uv run grok-voice-listener
claude mcp add grok-voice --scope user \
  -- uv run --project "$PWD" grok-voice-mcp
xdg-open http://127.0.0.1:8765         # paste your xAI API key on first contact
```

### Linux (Docker)

The daemon can run in a container, borrowing the host's microphone and
speakers through the PulseAudio/PipeWire socket:

```bash
docker compose up -d
xdg-open http://127.0.0.1:8765   # paste your xAI API key on first contact
```

Requirements: a user sound server on the host (PulseAudio, or PipeWire with
its pulse-compat socket — the default on modern desktop distros). The compose
file mounts `$XDG_RUNTIME_DIR/pulse/native` plus the Pulse auth cookie, and
keeps the API key/settings/history in a named volume.

Not for macOS: Docker there runs in a VM with no host audio devices — use the
native install instead.

### Hooks (voice input)

The hook scripts live in `hooks/` (they poll the daemon's queue and inject
your speech into the session) and are registered in `~/.claude/settings.json`:
`PostToolUse` delivers speech while Claude works, `Stop` wakes it when you
speak after a turn ends. They fail open — with the daemon down they exit
silently, so keyboard-only sessions are unaffected.

## Dashboard

Everything is controlled from <http://127.0.0.1:8765> (source in `dashboard/`,
Vue 3; the legacy dashboard remains at `/legacy`):

- live conversation log (replay ▶ / stop ⏹ / recall ✕ on queued messages),
- real-time oscilloscope + spectrum fed by the actual mic level,
- big MUTE MIC and MUTE CLAUDE (parks speech as UNHEARD, CATCH UP replays),
- push-to-talk (hold the button or the space bar) vs automatic VAD turns,
- per-agent character (voice, speed, personality gauges), microphone picker,
- costs, latencies, session ring, API-key settings.

## Configuration

Optional environment variables (most tuning lives in the dashboard and
persists in `~/.config/grok-voice/`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `GROK_VOICE_LISTENER_PORT` | `8765` | Port of the daemon's HTTP API |
| `GROK_VOICE_BIND` | `127.0.0.1` | HTTP bind address (`0.0.0.0` in Docker) |
| `GROK_VOICE_STT_LANGUAGE` | auto | Initial language hint for transcription |
| `GROK_VOICE_MODE` | `batch` | Initial STT mode (`batch`/`live`) |
| `GROK_VOICE_STOP_WAIT_SECONDS` | `30` | How long the Stop hook waits for speech |
| `GROK_VOICE_NO_AUTOSPAWN` | — | Don't auto-start the daemon from the server |

## Development

```bash
uv run pytest                      # python tests (offline, API mocked)
cd dashboard && npm test           # frontend tests (Vitest)
cd dashboard && npm run storybook  # component workbench
cd dashboard && npm run build      # the daemon serves dashboard/dist at /
```

Live smoke test (spends API credits, plays audio):

```bash
uv run python scripts/smoke_test.py "Hello from Grok"
```
