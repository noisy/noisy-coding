---
name: setup
description: Install or repair Noisy Studio for this machine - the native app that carries the voice daemon, plus the hooks that let Claude Code reach it. USE when the user asks how to install Noisy Studio, when the speak tool is missing or failing, when the dashboard is unreachable, when a fresh clone has no hooks configured, or when voice works one way only.
---

# Setting up Noisy Studio

Noisy Studio is a voice layer for Claude Code: a background **daemon** owns
the microphone and speakers, and this plugin's **hooks** carry your spoken
answers out and the user's speech in. Three things must be true at once -
the daemon running, the hooks registered, and both pointed at the same
port. Most "it doesn't work" is one of those three.

## Step 1: find the daemon

The daemon serves an HTTP status endpoint. Ask each port that could hold
one and stop at the first that answers:

```sh
for p in 9765 7765; do
  curl -s -o /dev/null -w "port $p: %{http_code}\n" --max-time 2 http://127.0.0.1:$p/status
done
```

- **9765** - the native app's daemon (the normal install).
- **7765** - a local dev instance from a checkout (see the local-development
  docs). Only relevant when working on Noisy Studio itself.
- **neither answers** - no daemon is running yet; go to step 2.

Whatever port answered is THE port for the rest of setup. Every hook and
the MCP server must use that same one.

## Step 2: run the engine

The daemon ships inside the **native app** (macOS first). Install it, open
it once, and it starts its own daemon on 9765 - no Docker, no Python for
the user to manage.

- Download the latest release asset from
  <https://github.com/noisy/noisy-coding/releases>, move it to
  `/Applications`.
- It is currently a **beta and unsigned**: the first launch needs
  **right-click -> Open**, because a double-click is blocked by macOS.

The engine needs speech credentials: open the dashboard (the app's
menu-bar icon, or the daemon's URL) and either paste a **provider API key**
or select the **local (offline) engine**. Without one there is no speech
and no transcription. Never ask the user to paste a key into a chat or a
terminal - the dashboard stores it at 0600 and nothing else should hold a
copy.

## Step 3: the hooks

**This is the step people miss - the daemon runs but Claude Code never
talks to it.** The plugin's MCP server gives you the `speak` tool; the
HOOKS report your activity, show what is being said, register your
conversation as a tab, and let a spoken sentence wake you after a turn.

If the plugin is installed, its `hooks.json` is already active - open
`/hooks` in Claude Code to confirm. Nothing more to do.

Without the plugin, register them once against the port from step 1:

```sh
python3 hooks/install.py --port 9765    # omit --port for the 8765 default
```

Then **restart Claude Code** - hooks are read once at startup. A hook
pointed at a port nothing listens on fails silently, which looks exactly
like a broken install, so the port must match step 1.

## Step 4: prove it end to end

Do not declare success from a status code. Ask the daemon, then make it
speak:

```sh
curl -s http://127.0.0.1:9765/status | head -c 200
```

Then call the `speak` tool with a short line. If the user hears it, the
whole chain works: hooks, MCP server, daemon, credentials, audio out. A
successful HTTP response alone is not proof.

## When something is wrong

- **No `speak` tool** - the MCP server did not connect. Run `/mcp` to
  reconnect; on a fresh install the daemon was probably not up when Claude
  Code started. Restart Claude Code once it is.
- **Hooks silent / voice one-way** - almost always the wrong port. The
  hooks and the MCP server must both use the port from step 1. The user's
  speech reaching you but your voice being mute (or the reverse) is the
  signature of a port or connection mismatch.
- **"Voice session identity is missing"** on speak - the hooks did not run
  (or ran against a daemon too old to register the conversation). Confirm
  the hooks are trusted in `/hooks` and the daemon on the chosen port is
  current, then start a new session.
- **A tab shows it is not listening** - the session's listening window
  lapsed or a restart cleared it; the user types once in the terminal, or
  restarts that session, to wake it. This is expected, not a fault.
- **Dashboard unreachable** - the daemon is not running. The app starts it
  automatically; reopen the app.
- **Two daemons** - they share the microphone but fight over the speakers
  and global hotkeys. Run one.
