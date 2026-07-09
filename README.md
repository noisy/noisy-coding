# grok-voice-mcp

MCP server that gives Claude Code a voice. Instead of (or rather, alongside) a
wall of text, Claude can call the `speak` tool to read a short spoken summary
aloud through your speakers, synthesized by the [Grok (xAI) Voice API](https://docs.x.ai/developers/rest-api-reference/inference/voice).

## Tools

| Tool | What it does |
| --- | --- |
| `speak(text, voice_id?, language?, speed?)` | Synthesizes `text` via `POST /v1/tts` and plays it through the speakers (`afplay` on macOS, `mpv`/`ffplay` elsewhere). |
| `list_voices()` | Lists the built-in Grok voices (`ara`, `eve`, `leo`, `rex`, `sal`, …). |

## Roadmap

- **v1 (done)** — voice output: Claude speaks short summaries to you.
- **v2 (done)** — voice input: an always-on listener daemon + Claude Code hooks,
  so you can talk to Claude hands-free while it works.

## v2: how voice input works

MCP has no push mechanism, so the listener is a separate daemon and the
"push" is done by Claude Code hooks:

```
mic -> VAD (energy, adaptive noise floor) -> Grok STT (POST /v1/stt)
    -> transcript queue -> HTTP on 127.0.0.1:8765
         ^ polled by hooks:
           - PostToolUse: injects queued speech after every tool call
           - Stop: keeps the conversation alive at turn boundaries; two modes
             via GROK_VOICE_STOP_MODE:
               sync   — blocks the turn end while polling (30s / 2s when
                        voice is inactive)
               rewake — asyncRewake background hook: the turn ends instantly,
                        the hook polls for up to 5 min and wakes the model
                        when you speak (experimental)
```

Start the daemon (first run triggers the macOS microphone permission prompt):

```bash
uv run grok-voice-listener
```

The hook scripts live in `hooks/` (stdlib-only, run on system python3) and are
registered in `~/.claude/settings.json`. They fail open: with the daemon down
they exit silently in under a second, so keyboard-only sessions are unaffected.

## Setup

Requires Python 3.13 (pyenv) and [uv](https://docs.astral.sh/uv/).

```bash
uv sync --all-groups
```

## Configuration

Environment variables (set them in the MCP server config, not in the repo):

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `XAI_API_KEY` | yes | — | xAI API key |
| `GROK_VOICE_DEFAULT_VOICE` | no | `eve` | Voice used when the tool call doesn't specify one |
| `GROK_VOICE_DEFAULT_LANGUAGE` | no | `en` | BCP-47 language code, or `auto` |
| `GROK_VOICE_LISTENER_PORT` | no | `8765` | Port of the listener daemon's queue API |
| `GROK_VOICE_STT_LANGUAGE` | no | auto | Language hint for transcription (e.g. `pl`) |
| `GROK_VOICE_STOP_WAIT_SECONDS` | no | `30` | How long the Stop hook waits for speech |

## Registering in Claude Code

```bash
claude mcp add grok-voice --scope user \
  -e XAI_API_KEY=xai-... \
  -- uv run --project /path/to/grok-voice-mcp grok-voice-mcp
```

## Development

```bash
uv run pytest        # unit tests (offline, API mocked)
uv run ruff check .
```

Live smoke test (spends API credits, plays audio):

```bash
XAI_API_KEY=xai-... uv run python scripts/smoke_test.py "Hello from Grok"
```
