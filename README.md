# grok-voice-mcp

Voice conversations with Claude Code. Claude speaks short summaries aloud,
and an always-on listener daemon turns your speech into messages Claude
receives **while it works** — powered by the
[Grok (xAI) Voice API](https://docs.x.ai/developers/rest-api-reference/inference/voice)
and a live "tactical HUD" dashboard.

## Quick start (Docker — any OS)

The container is hardware-free: **all audio flows through the dashboard
page** (the browser tab is the microphone and the speaker). The host needs
Docker, a browser and `git` — nothing else, on macOS, Windows and Linux
alike. All configuration happens in the UI.

```bash
git clone <this repo> && cd grok-voice-mcp

# 1. the whole backend in one box
docker compose up -d

# 2. open the dashboard
#    - paste your xAI API key when asked (console.x.ai)
#    - Settings → MICROPHONE: THIS BROWSER TAB (allow the mic prompt)
#    - Settings → OUTPUT: THIS BROWSER TAB
open http://127.0.0.1:8765

# 3. connect Claude Code to the MCP server in the container
claude mcp add --transport http --scope user grok-voice http://127.0.0.1:8767/mcp

# 4. register the hooks (this is how Claude HEARS you) and restart Claude Code
python3 hooks/install.py
```

That's it — talk. Voice, speed, personality, language, push-to-talk,
transcription mode: everything lives in the dashboard and persists across
restarts (in a Docker volume). No environment variables, no config files.

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
git clone <this repo> && cd grok-voice-mcp
uv sync
uv run grok-voice-listener            # first run triggers the mic prompt
claude mcp add grok-voice --scope user \
  -- uv run --project "$PWD" grok-voice-mcp
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
dashboard writes everything to `~/.config/grok-voice/` (a named volume in
Docker). The environment variables below exist for development and unusual
setups only:

| Variable | Default | Meaning |
| --- | --- | --- |
| `GROK_VOICE_LISTENER_PORT` | `8765` | Port of the daemon's HTTP API |
| `GROK_VOICE_BIND` | `127.0.0.1` | HTTP/WS bind address (`0.0.0.0` in Docker) |
| `GROK_VOICE_STT_LANGUAGE` | auto | Initial language hint (the UI selector overrides) |
| `GROK_VOICE_MODE` | `batch` | Initial STT mode (`batch`/`live`) |
| `GROK_VOICE_STOP_WAIT_SECONDS` | `30` | How long the Stop hook waits for speech |
| `GROK_VOICE_NO_AUTOSPAWN` | — | Don't auto-start the daemon from the server |
| `GROK_VOICE_INPUT_DEVICE` | system default | Initial mic (`browser` = the dashboard tab) |
| `GROK_VOICE_OUTPUT_DEVICE` | `system` | Initial speaker (`browser` = the dashboard tab) |
| `GROK_VOICE_MCP_TRANSPORT` | `stdio` | `http` exposes the MCP server (Docker) |
| `GROK_VOICE_MCP_PORT` | `8767` | MCP HTTP port (with `http` transport) |

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
