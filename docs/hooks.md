# Why noisy-coding integrates with five Claude Code hooks

Noisy-coding turns Claude Code into a voice conversation partner without
changing Claude Code itself. Everything rides on hooks: they carry your spoken
words *into* the model and report the model's activity *out* to the dashboard.

The project started with a single hook — `Stop`, the one that keeps a
conversation alive after a turn ends. Each of the other four was added to fix
a concrete gap that showed up in real voice sessions. This document explains
what each hook does, why it exists, and where the hooks get registered.

Every hook **fails open**: if the daemon is not running, the hook exits
silently and Claude Code behaves exactly as if noisy-coding were not installed.
Keyboard-only sessions pay (almost) nothing.

## The five hooks at a glance

| # | Event | Matcher | Script | Purpose |
|---|-------|---------|--------|---------|
| 1 | `Stop` | — | `stop.py` | Keep the conversation alive: wait for your voice after a turn ends and wake the model with the transcript |
| 2 | `PostToolUse` | `*` | `post_tool_use.py` | Deliver speech *mid-turn*: inject anything you said while a tool was running |
| 3 | `PreToolUse` | `*` | `pre_tool_use.py` | Live dashboard: show what Claude is doing right now ("Edit · App.vue") |
| 4 | `PreToolUse` | `mcp__noisy-coding__speak` | `pre_speak.py` | Echo the spoken text into the terminal while the speak call plays |
| 5 | `UserPromptSubmit` | — | `user_prompt_submit.py` | Light the "THINKING…" indicator from the very first token of a turn |

Two of these carry voice into the model (1, 2); three exist purely so the human
can see what is going on (3, 4, 5).

## 1. `Stop` — the heart of the system

**The gap.** Without it, a voice conversation dies at every turn boundary:
Claude answers, the turn closes, and whatever you say *after* the answer has
no path back to the model. Voice chat would degenerate into
one-question-per-session.

**How it works.** When a turn is about to end, `stop.py` polls the daemon's
`/drain` endpoint for fresh transcripts. It runs in **rewake mode**
(`asyncRewake: true`): the turn ends normally, the terminal is free,
and the hook stays behind as a background listener for up to ~60 minutes.
When you speak, it waits a short grace period (2 s, capped at 20 s) so a
longer musing is not answered mid-thought, then exits with code 2 — which
wakes the model with your transcript as the next input.

**Example.** Claude finishes explaining a bug. You sip coffee, think for
four minutes, then say *"okay, apply the fix but keep the old test."* The
rewake poller has been listening the whole time; Claude wakes and starts
working. No keyboard was touched.

Because the poller is asynchronous, keyboard-only sessions are unaffected:
the turn ends instantly either way, and an idle poller simply expires.

A lock file (`~/.config/noisy-coding/rewake-default.lock`) ensures that when
several sessions are open, only one poller claims the voice stream.

## 2. `PostToolUse` (all tools) — speech delivered mid-work

**The gap.** The `Stop` hook only fires at the *end* of a turn. When Claude
grinds through a long multi-tool task, anything you say meanwhile would arrive
minutes too late — including *"stop, that's the wrong file."*

**How it works.** After **every** completed tool call, the hook drains queued
transcripts and injects them as `additionalContext` tagged `[VOICE]`, with an
instruction to change course if that is what you asked. It also flips the
dashboard activity line to "THINKING…" (the tool finished; the model is
reasoning again).

**Example.** Claude is renaming a symbol across 40 files. Ten files in, you
say *"skip the tests directory."* The next hook invocation hands the sentence
to the model between two edits, and the remaining files are handled your way.

## 3. `PreToolUse` (all tools) — a dashboard that shows what's happening

**The gap.** You talk to a black box: transcripts sat in AWAITING on the
dashboard with no clue what Claude was busy with, which read as "it ignored
me."

**How it works.** When any tool starts, the hook POSTs one human-readable
line to the daemon's `/activity` endpoint — `Edit · App.vue`,
`Bash · docker ps…`, `SPEAKING · „Done, tests pass"` — and the dashboard
renders it as the agent's busy bubble. Purely informational; it never blocks
the call.

## 4. `PreToolUse` on `speak` — see what is being said

**The gap.** The `speak` tool blocks through synthesis *and* playback. In the
terminal that looked like a bare spinner for many seconds — and with muted
speakers you could not even tell speech was happening.

**How it works.** Before the call runs, the hook prints a `systemMessage`
with the utterance (truncated to 220 chars): `🔊 carina: „Build is green,
deploying now"`. The terminal shows the words next to the spinner.

## 5. `UserPromptSubmit` — activity from the first token

**The gap.** Tool hooks fire only around tool calls. A turn that *opens* with
a long reasoning stretch showed no activity at all — the dashboard stayed
silent although the model was already thinking.

**How it works.** The moment a prompt is accepted, the hook sets the activity
line to "THINKING…". The youngest and simplest hook.

## Shared plumbing

- **`_agent_identity.py`** — a library, not a hook. Every hook invocation
  POSTs `/register`, which is how the daemon knows which agents are alive
  (the dashboard tabs) and which agent each transcript belongs to.
- **`exec.sh`** — interpreter-picking launcher used by the plugin variant.

## Where the hooks get registered

The hook *scripts* are the same everywhere; what differs is who registers
them and where they execute. There are three paths — you should have exactly
**one** active, determined by how you installed noisy-coding:

| Install path | Registered in | Command shape | Scripts run |
|---|---|---|---|
| Plugin (recommended) | plugin's `hooks/hooks.json`, auto-loaded | `sh ${CLAUDE_PLUGIN_ROOT}/hooks/exec.sh <script>.py` | from the installed plugin |
| Installer, docker mode | `~/.claude/settings.json` via `python3 hooks/install.py --docker` | `docker exec -i noisy-coding python3 /app/hooks/<script>.py` | **inside the container** |
| Installer, local mode | `~/.claude/settings.json` via `python3 hooks/install.py` | `python3 <checkout>/hooks/<script>.py` | from your checkout |

Notes:

- The **docker mode** is fully hermetic — hooks, scripts and daemon all live
  in the container, and the host needs no Python at all. The flip side: the
  session's environment variables (e.g. `NOISY_CODING_LISTENER_PORT`) do not
  reach the scripts, so these hooks always talk to the containerized daemon.
- The **installer is idempotent**: rerunning it replaces noisy-coding entries
  in `settings.json` in place and leaves everything else untouched.
- Having both the plugin *and* installer-written entries active would fire
  every hook twice. If you switch install paths, remove the old registration.

## Development vs production

The production setup (docker-mode hooks + containerized daemon) is deliberately
sealed. To point a session at a locally-run development daemon instead,
override the hooks **per project** (`.claude/settings.json` in this repo) with
local-mode commands that set `NOISY_CODING_LISTENER_PORT` to the dev port.
Every script reads that variable at invocation time and falls back to 8765,
so no code changes are needed — only a second daemon on shifted ports and a
project-scoped hook registration.
