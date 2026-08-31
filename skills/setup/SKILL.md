---
name: setup
description: Install or repair noisy-coding for this machine - the desktop app or the Docker container, plus the hooks that let Claude Code reach it. USE when the user asks how to install noisy-coding, when the speak tool is missing or failing, when the dashboard is unreachable, when a fresh clone has no hooks configured, or when they want to move from Docker to the desktop app.
---

# Setting up noisy-coding

Two ways to run it, and the setup differs. Find out which one applies
before giving instructions - guessing produces advice that cannot work.

## Step 1: what is already here?

Run these. They answer the only questions that matter.

```sh
curl -s -o /dev/null -w "app     :9765 %{http_code}\n" --max-time 2 http://127.0.0.1:9765/status
curl -s -o /dev/null -w "docker  :8765 %{http_code}\n" --max-time 2 http://127.0.0.1:8765/status
docker ps --filter name=noisy-coding --format "container: {{.Status}}" 2>/dev/null
ls -d "/Applications/Noisy Coding.app" 2>/dev/null
```

| What answers | What it means |
|---|---|
| `:9765` | the desktop app is installed and running |
| `:8765` or a container | the Docker install is running |
| neither | nothing is set up yet - go to step 2 |

## Step 2: install the engine

Ask which the user wants; do not decide for them. The honest summary:

**Desktop app** (macOS, recommended)
- one download, an icon, no Docker, no Python
- carries its own daemon and starts it automatically
- currently a **beta**, and **unsigned**: the first launch needs
  right-click -> Open, because macOS blocks a double-click

**Docker** (Linux, servers, headless, or an existing install)
- the long-standing path, still supported
- needs Docker running, pulls an image, more moving parts
- the only option where the daemon can live on another machine

To install the app: download the latest release asset from
<https://github.com/noisy/noisy-coding/releases>, move it to
`/Applications`, then **right-click -> Open** once.

To install Docker:

```sh
git clone https://github.com/noisy/noisy-coding.git
cd noisy-coding && docker compose up -d
```

Either way, the engine needs an **xAI API key**: open the dashboard (the
app's menu-bar icon, or <http://127.0.0.1:8765>) and paste it. Without a
key there is no speech and no transcription. Never ask the user to paste
the key into a chat or a terminal - the dashboard stores it at 0600 and
nothing else should ever hold a copy.

## Step 3: the hooks

**This is the step people miss, and without it the daemon runs but Claude
Code never talks to it.** The plugin's MCP server gives you the `speak`
tool; the HOOKS are what report your activity, show what is being said,
and let a spoken sentence wake a stopped agent.

If the plugin is installed, its own `hooks.json` is already active - check
`/hooks` in Claude Code. Nothing more to do.

Without the plugin, register them once:

```sh
python3 hooks/install.py            # a local checkout
python3 hooks/install.py --docker   # run the hooks inside the container
```

Then restart Claude Code, or `/mcp` and reconnect.

**Point them at the right daemon.** Each hook command honours
`NOISY_CODING_LISTENER_PORT`; the default is 8765. With the desktop app,
the port is **9765**, so either export that variable or edit the commands
in `settings.json`. A hook talking to a port nothing listens on fails
silently - which looks exactly like a broken install.

## Step 4: prove it works

Do not declare success from a status code. Ask the daemon and then make it
speak:

```sh
curl -s http://127.0.0.1:9765/status | head -c 200     # or :8765
```

Then call the `speak` tool with a short line. If the user hears it, the
whole chain works: hooks, MCP server, daemon, API key, audio output.

If they do not hear it, in this order: is the key set (`api_key_set` in
`/status`), is speech muted (`voice_muted`), is the output device right
(Settings in the dashboard)?

## When something is wrong

- **No `speak` tool** - the MCP server did not connect. `/mcp` to reconnect;
  on a fresh install the daemon was probably not running yet when Claude
  Code started
- **Hooks silent** - almost always the wrong port, see step 3
- **Dashboard unreachable** - the daemon is not running. The app starts it
  automatically; Docker needs `docker compose up -d`
- **Two daemons** - they share the microphone happily but fight over the
  speakers and the global hotkeys. Run one
