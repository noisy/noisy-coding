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

- **v1 (this)** — voice output: Claude speaks short summaries to you.
- **v2** — voice input: a `listen` tool using Grok STT so you can talk back.

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
