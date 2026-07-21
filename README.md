# noisy-coding

**Talk to Claude Code while it works — Jarvis-style voice coding.**
It's your voice that's noisy, not your code.

[![Docker Pulls](https://img.shields.io/docker/pulls/noisy/noisy-coding)](https://hub.docker.com/r/noisy/noisy-coding)
[![Release](https://img.shields.io/github/v/release/noisy/noisy-coding)](https://github.com/noisy/noisy-coding/releases)
[![CI](https://github.com/noisy/noisy-coding/actions/workflows/ci.yml/badge.svg)](https://github.com/noisy/noisy-coding/actions/workflows/ci.yml)
[![Last commit](https://img.shields.io/github/last-commit/noisy/noisy-coding)](https://github.com/noisy/noisy-coding/commits/main)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Claude speaks short summaries aloud. An always-on listener turns your
speech into messages Claude receives **mid-task, without stopping it** —
no push-to-send, no copy-pasting transcripts. Step away from the keyboard
and keep steering your agent.

## Why you'll like it

- **Interrupt-free flow** — speak while Claude is working; your words land
  in the running session, not a text box.
- **Hands-free reviews** — Claude reads its findings aloud; you answer
  from across the room.
- **Live "tactical HUD" dashboard** — conversation log with replay/recall,
  real-time oscilloscope, mute buttons, costs and latencies at a glance.
- **Per-agent character** — voice, speed, and personality dials for every
  agent, all from the dashboard.
- **Nothing to configure in files** — API key, devices, language,
  push-to-talk: everything lives in the UI and persists.
- **Never talks over you** — one voice at a time; speech you missed parks
  as UNHEARD and a CATCH UP button replays it.

Speech-to-text and text-to-speech run on the
[Grok (xAI) Voice API](https://docs.x.ai/developers/rest-api-reference/inference/voice) —
extremely cheap in practice (a small one-time budget lasts months of
daily use).

## Install in 2 minutes

The backend ships as a hardware-free Docker image
([`noisy/noisy-coding`](https://hub.docker.com/r/noisy/noisy-coding)):
the dashboard browser tab is the microphone and the speaker. You need
Docker and a browser — no Python, no git, no environment variables.

```bash
# terminal: marketplace + plugin in one line
claude plugin marketplace add noisy/noisy-coding && claude plugin install noisy-coding@noisy
```

```
# inside Claude Code (new session):
/noisy-coding:setup
```

The setup command starts the published image and walks you through first
contact. Then finish in the browser at <http://127.0.0.1:8765>: paste
your xAI API key (console.x.ai) and click the amber **ENABLE TAB AUDIO**
banner — that one click makes the tab your microphone and speaker. Keep
the tab open and just talk.

Prefer staying inside Claude Code? Same thing, four commands:
`/plugin marketplace add noisy/noisy-coding` →
`/plugin install noisy-coding@noisy` → `/reload-plugins` →
`/noisy-coding:setup`.

Other setups — plain Docker without the plugin, native install with
hardware mic/speakers, remote hosts, all configuration knobs — live in
[docs/INSTALL.md](docs/INSTALL.md).

## How it works

All speech logic lives in one **listener daemon** — the single owner of
the microphone, the playback queue and the speakers. The MCP server is a
thin messenger that forwards `speak` requests; Claude Code hooks deliver
your transcribed speech back into the session (see
[docs/hooks.md](docs/hooks.md)).

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

## Docs

- [docs/INSTALL.md](docs/INSTALL.md) — plain Docker, native install,
  remote hosts, environment variables, development commands
- [docs/hooks.md](docs/hooks.md) — how Claude hears you
- [docs/ports.md](docs/ports.md) — what each port is for
- [docs/local-development.md](docs/local-development.md) — hacking on
  noisy-coding itself

## License

[MIT](LICENSE) © Krzysztof Szumny
