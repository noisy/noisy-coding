# The desktop app

Status: **the shell exists, the daemon is not bundled yet.** This describes
where it is going and what is still missing. It is a plan, not install
instructions - nobody can install it this way today.

## What exists

`desktop/` is an Electron shell, deliberately thin, that hosts two windows:

- the **dashboard**, an ordinary window with the full UI
- the **widget**, frameless, transparent, always on top, click-through on
  demand

Both are views of the bundle the daemon already serves, so the app
duplicates nothing. On launch it looks for a daemon it can actually use and
attaches to it; the menu bar shows which one.

    9765   its own (once bundled)   tried first
    7765   a developer instance     then this
    8765   production, Docker       last: a published image may predate the
                                    views this app needs

It probes for the VIEW it needs, not merely for a daemon that is alive -
an older one answers `/status` and then 404s the widget, which looks like a
broken app rather than an unsuitable daemon.

## What is missing before it can stand alone

**1. The daemon inside the app.** Freeze the Python (PyInstaller or a `uv`
standalone build) into the app's resources, spawn it on 9765 at launch,
stop it on quit. One download, one icon, and the user never learns Python
is involved. Everything else on this list is small by comparison.

**2. The hooks.** This is the part that does not fit the "just an app"
story, and it is worth stating plainly:

noisy-coding is not only a daemon and a UI. Claude Code reaches it through
**hooks** configured in `.claude/settings.json`, which name a port. A user
who installs the app still has to point their hooks at whichever daemon the
app is running - otherwise the app is a pretty window that no agent talks
to.

So the installer has to either write that configuration, or the app has to
offer a one-click "connect this project", or the plugin has to discover the
port itself. Undecided. It is the single biggest difference between "an app
you install" and "a tool you set up", and it should be decided before any
install documentation is written.

**3. Coexistence.** Attaching to an existing daemon is done. Not done: what
happens when the user has Docker running AND the app spawns its own. Two
daemons mean two microphones competing for one device.

## On dropping Docker

Tempting once the app carries its own daemon - and for a Mac user the app
is strictly better. But Docker is not only a packaging choice:

- **Linux and headless** installs have no app and no menu bar
- **Servers and remote machines** run the daemon somewhere else entirely
- **The MCP endpoint** is a service others connect to, not just a UI

So "drop Docker" is really "drop Docker FOR MAC DESKTOP USERS", which is a
different and much safer statement. A reasonable end state is: the app is
the recommended path on macOS and Windows, Docker remains for Linux,
servers and anyone who wants it.

Worth deciding deliberately rather than by attrition, and worth a major
version if the default install path changes.

## When this is real

Add an "Install (macOS app)" section to the README and the plugin skill,
covering: download, first launch (unsigned - right-click Open), how hooks
get configured, and how to tell which daemon is answering. Not before -
instructions for a flow that does not exist are worse than none.
