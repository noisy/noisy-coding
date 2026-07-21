# Installation options

The recommended path is the Claude Code plugin — see the
[README](../README.md#install-in-2-minutes). This page covers everything
else: plain Docker, native install, remote hosts, and configuration.

## Plain Docker (no plugin, nothing to clone)

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

## Hooks (how Claude hears you)

`python3 hooks/install.py` registers them in `~/.claude/settings.json`
(user scope, idempotent — run it again after moving the repo). They are
stdlib-only and run on the system `python3` (3.9+): `PostToolUse` delivers
speech while Claude works, `Stop` wakes an idle session when you speak,
`UserPromptSubmit`/`PreToolUse` feed the dashboard's live-activity line.
They fail open — with the daemon down they exit silently, so keyboard-only
sessions are unaffected.

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

Hacking on noisy-coding itself? See
[local-development.md](local-development.md) for running a dev instance
next to production.
