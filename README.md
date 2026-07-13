# noisy-coding

Voice coding for Claude Code, Jarvis-style — talk to your agent while it
works. It's your voice that's noisy, not your code. Claude speaks short
summaries aloud, and an always-on listener daemon turns your speech into
messages Claude receives **while it works** — powered by the
[Grok (xAI) Voice API](https://docs.x.ai/developers/rest-api-reference/inference/voice)
and a live "tactical HUD" dashboard.

## Quick start (Claude Code plugin — any OS, nothing to clone)

The backend ships as a hardware-free Docker image ([`noisy/noisy-coding`](https://hub.docker.com/r/noisy/noisy-coding)):
**all audio flows through the dashboard page** (the browser tab is the
microphone and the speaker). The host needs Docker and a browser — no
Python, no git, no environment variables. Inside Claude Code:

```
/plugin marketplace add noisy/noisy-coding
/plugin install noisy-coding@noisy
/noisy-coding:setup
```

The setup command starts the published image and walks you through first
contact; the plugin itself carries the MCP connection and the voice hooks
(they run inside the container via `docker exec`). Then finish in the
browser at <http://127.0.0.1:8765>: paste your xAI API key
(console.x.ai), pick **MICROPHONE: THIS BROWSER TAB** and
**OUTPUT: THIS BROWSER TAB** in Settings — and just talk.

### Plain Docker (no plugin, still nothing to clone)

```bash
# 1. the whole backend in one box, straight from Docker Hub
docker run -d --name noisy-coding \
  -p 127.0.0.1:8765-8767:8765-8767 \
  -v noisy-coding-config:/root/.config/noisy-coding \
  --restart unless-stopped \
  noisy/noisy-coding:latest

# 2. dashboard: API key + THIS BROWSER TAB (mic and output) in Settings
open http://127.0.0.1:8765

# 3. connect Claude Code to the MCP server in the container
claude mcp add --transport http --scope user noisy-coding http://127.0.0.1:8767/mcp

# 4. register the hooks (this is how Claude HEARS you), restart Claude Code
docker run --rm -v ~/.claude:/root/.claude noisy/noisy-coding \
  python3 /app/hooks/install.py --docker
```

Voice, speed, personality, language, push-to-talk, transcription mode:
everything lives in the dashboard and persists across restarts (in a
Docker volume). No environment variables, no config files.

Notes:

- The dashboard tab is the audio device — keep it open while talking.
  Speech that arrives with no tab open parks as UNHEARD; the CATCH UP
  button replays it when you return.
- Remote host? `getUserMedia` needs a secure context, so tunnel instead of
  exposing plain HTTP:
  `ssh -L 8765:localhost:8765 -L 8766:localhost:8766 -L 8767:localhost:8767 host`
- Linux can alternatively pass the host's PulseAudio/PipeWire socket
  through for native audio — see the commented variant in
  `docker-compose.yml`.

## How it works (fat daemon / thin server)

All speech logic lives in one **listener daemon** — the single owner of the
microphone, the playback queue (one voice at a time, never talking over
you) and the speakers. The MCP server is a thin messenger that forwards
`speak` requests over HTTP. Claude Code hooks deliver your transcribed
speech back into the session.

```
mic (hardware or browser tab via WS :8766)
  -> VAD -> Grok STT -> transcript queue -> HTTP :8765
                              ^ polled by Claude Code hooks
speak (MCP, stdio or HTTP :8767) -> POST /speak -> daemon queue
  -> Grok TTS -> speakers (hardware or browser tab)
```

## Tools

| Tool | What it does |
| --- | --- |
| `speak(text, interrupt?)` | Queues `text` for speech and waits until it has played. Voice/speed/language come from the daemon (dashboard character), not the call. |
| `announce(text)` | Fire-and-forget variant: returns immediately, plays in the background. |
| `change_voice(voice_id)` | Deliberately switches this agent's voice (persists, shows on the dashboard). |
| `list_voices()` | Lists the built-in Grok voices (`ara`, `eve`, `leo`, `rex`, …). |

## Hooks (how Claude hears you)

`python3 hooks/install.py` registers them in `~/.claude/settings.json`
(user scope, idempotent — run it again after moving the repo). They are
stdlib-only and run on the system `python3` (3.9+): `PostToolUse` delivers
speech while Claude works, `Stop` wakes an idle session when you speak,
`UserPromptSubmit`/`PreToolUse` feed the dashboard's live-activity line.
They fail open — with the daemon down they exit silently, so keyboard-only
sessions are unaffected.

## Native install (alternative to Docker)

For always-on voice without a browser tab (hardware mic/speakers), run the
daemon natively. Requires Python 3.13 and
[uv](https://docs.astral.sh/uv/); the API key is still configured in the
dashboard, never in the shell.

```bash
git clone https://github.com/noisy/noisy-coding && cd noisy-coding
uv sync
uv run noisy-coding-listener          # first run triggers the mic prompt
claude mcp add noisy-coding --scope user \
  -- uv run --project "$PWD" noisy-coding-mcp
python3 hooks/install.py
open http://127.0.0.1:8765            # paste your xAI API key
```

macOS plays through the built-in `afplay`; installing `mpv` (optional)
enables lower-latency streaming playback. Linux needs
`sudo apt install libportaudio2 mpv`.

## Dashboard

Everything is controlled from <http://127.0.0.1:8765> (source in
`dashboard/`, Vue 3; the legacy dashboard remains at `/legacy`):

- live conversation log (replay ▶ / stop ⏹ / recall ✕ on queued messages),
- real-time oscilloscope + spectrum fed by the actual mic level,
- big MUTE MIC and MUTE CLAUDE (parks speech as UNHEARD, CATCH UP replays),
- push-to-talk (hold the button or the space bar) vs automatic VAD turns,
- per-agent character (voice, speed, personality gauges),
- device pickers — including THIS BROWSER TAB as mic and output,
- costs, latencies, session ring, API-key settings.

## Configuration

There is deliberately **no required configuration outside the UI** — the
dashboard writes everything to `~/.config/noisy-coding/` (a named volume in
Docker). The environment variables below exist for development and unusual
setups only:

| Variable | Default | Meaning |
| --- | --- | --- |
| `NOISY_CODING_LISTENER_PORT` | `8765` | Port of the daemon's HTTP API |
| `NOISY_CODING_BIND` | `127.0.0.1` | HTTP/WS bind address (`0.0.0.0` in Docker) |
| `NOISY_CODING_STT_LANGUAGE` | auto | Initial language hint (the UI selector overrides) |
| `NOISY_CODING_MODE` | `batch` | Initial STT mode (`batch`/`live`) |
| `NOISY_CODING_STOP_WAIT_SECONDS` | `30` | How long the Stop hook waits for speech |
| `NOISY_CODING_NO_AUTOSPAWN` | — | Don't auto-start the daemon from the server |
| `NOISY_CODING_INPUT_DEVICE` | system default | Initial mic (`browser` = the dashboard tab) |
| `NOISY_CODING_OUTPUT_DEVICE` | `system` | Initial speaker (`browser` = the dashboard tab) |
| `NOISY_CODING_MCP_TRANSPORT` | `stdio` | `http` exposes the MCP server (Docker) |
| `NOISY_CODING_MCP_PORT` | `8767` | MCP HTTP port (with `http` transport) |

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
