"""MCP server that lets the assistant speak to the user via Grok Voice.

Thin messenger: all rendering, playback, queueing and turn-taking live in
the listener daemon (the single owner of mic and speakers). This server
just forwards speak/announce requests over localhost HTTP — so a stale
server process left behind by an MCP reconnect can't talk over anyone.
"""

import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
from mcp.server.fastmcp import FastMCP

from grok_voice_mcp import tts

LISTENER_PORT_ENV_VAR = "GROK_VOICE_LISTENER_PORT"
# speak blocks until the daemon has waited out the user's turn, rendered
# AND played the utterance — allow for a long queue ahead of us.
SPEAK_TIMEOUT_SECONDS = 180.0
DAEMON_DOWN_MESSAGE = (
    "The voice daemon is not reachable, so nothing was spoken. "
    "Deliver the message in writing instead."
)

_SESSIONS_MAP = Path.home() / ".config" / "grok-voice" / "sessions.json"


def _agent_name() -> str:
    """This server's agent id.

    The MCP server can't see the Claude session_id, so: use an explicit
    GROK_VOICE_AGENT_NAME if set (per-config mode); otherwise look up the
    per-session id the hooks recorded for this working directory.
    """
    env_name = os.environ.get("GROK_VOICE_AGENT_NAME", "").strip()
    if env_name:
        return env_name
    try:
        data = json.loads(_SESSIONS_MAP.read_text())
        return str(data.get(os.getcwd(), {}).get("agent", ""))
    except (OSError, ValueError):
        return ""


mcp = FastMCP("grok-voice")


async def _daemon_speak(body: dict) -> dict | None:
    """POST /speak to the daemon; None when it's unreachable (fail open).

    A daemon that is merely starting up must not turn speak into an
    exception — on the first failure we (re)spawn it and retry once.
    """
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    body = dict(body)
    agent = _agent_name()
    if agent:
        body["agent"] = agent
    timeout = httpx.Timeout(SPEAK_TIMEOUT_SECONDS, connect=2.0)
    for attempt in (0, 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"http://127.0.0.1:{port}/speak", json=body
                )
                return response.json()
        except (httpx.HTTPError, ValueError):
            if attempt == 0:
                await asyncio.to_thread(_ensure_daemon)
    return None


def _speak_result_message(result: dict | None) -> str | None:
    """Shared failure reporting for speak/announce; None means success."""
    if result is None:
        return DAEMON_DOWN_MESSAGE
    if "error" in result:
        return f"Speech failed: {result['error']}"
    return None


@mcp.tool()
async def speak(text: str, interrupt: bool = False) -> str:
    """Speak a short message aloud to the user through their speakers.

    Use this to deliver a spoken TL;DR alongside (not instead of) your written
    answer: 1-3 conversational sentences summarizing the outcome, a finding,
    or a question. Never read code, file paths, or long explanations aloud.

    You send only the text: voice, speed and language belong to the daemon
    (the user controls them on the dashboard). To deliberately switch your
    voice, call change_voice.

    Concurrent speech is serialized: by default a new call WAITS for the
    current utterance to finish (queued), and for the user to finish
    speaking. Set interrupt=True to cut the current utterance off and speak
    immediately — use it only when your previous words are now stale (e.g.
    the user corrected you mid-answer).

    Args:
        text: What to say. Plain conversational prose. Mark the key words the
            listener must catch with markdown bold (**like this**) — they get
            vocal emphasis and show bold on the live dashboard. Also supports
            inline speech tags like [pause] or [laugh] and wrapping tags like
            <soft>text</soft>.
        interrupt: Cut off any utterance currently playing and speak now.
    """
    result = await _daemon_speak({"text": text, "interrupt": interrupt, "wait": True})
    failure = _speak_result_message(result)
    if failure:
        return failure
    return f"Spoke the message aloud with voice '{result.get('voice', '?')}'."


@mcp.tool()
async def announce(text: str) -> str:
    """Speak a quick spoken update WITHOUT waiting for it to finish.

    Fire-and-forget: use this to tell the user what you just did and keep
    working ("done with X, moving on") — it returns immediately and plays in
    the background, queued behind any current speech. Use `speak` instead when
    you are asking a question or otherwise waiting for the user's reply.
    Like speak, it carries only text — voice/speed/language live in the daemon.
    """
    result = await _daemon_speak({"text": text, "wait": False})
    failure = _speak_result_message(result)
    if failure:
        return failure
    return "Announcement queued; playing in the background."


@mcp.tool()
async def change_voice(voice_id: str) -> str:
    """Deliberately switch this agent's speaking voice from now on.

    Updates your character in the listener daemon: the dashboard shows the
    new voice and every later speak/announce uses it (it also persists
    across restarts). Use list_voices to see the options. Speak itself
    carries no voice information — this call is the only way to change how
    you sound, so use it consciously (e.g. when the user asks for it).
    """
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    body: dict = {"voice_id": voice_id}
    agent = _agent_name()
    if agent:
        body["agent"] = agent
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(f"http://127.0.0.1:{port}/voice", json=body)
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return "The voice daemon is not reachable; your voice is unchanged."
    if "error" in data:
        return f"Voice change failed: {data['error']}"
    return f"Voice changed to '{data['voice']}' for all your future speech."


@mcp.tool()
async def list_voices() -> list[dict]:
    """List the Grok TTS voices available for the speak tool."""
    return await tts.list_voices()


def _daemon_running(port: int) -> bool:
    """True if something is already listening on the daemon's port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.3)
        return probe.connect_ex(("127.0.0.1", port)) == 0


def _ensure_daemon() -> None:
    """Adopt a running listener daemon, or spawn one as a child process.

    Daily use: the server spawns the daemon so voice "just works" with no
    manual step. Development: start the daemon yourself first — the server
    sees the port taken, adopts it, and you keep restarting the daemon in
    place without touching the server. Set GROK_VOICE_NO_AUTOSPAWN=1 to opt
    out (e.g. to always manage the daemon by hand).
    """
    if os.environ.get("GROK_VOICE_NO_AUTOSPAWN"):
        return
    port = int(os.environ.get(LISTENER_PORT_ENV_VAR, "8765"))
    if _daemon_running(port):
        return  # adopt the existing daemon
    try:
        # Child process: dies with the server (no orphaned daemons). A dev
        # daemon started by hand is a separate process and outlives us.
        subprocess.Popen(
            [sys.executable, "-m", "grok_voice_mcp.listener.daemon"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(20):  # wait up to ~2s for it to come up
            if _daemon_running(port):
                break
            time.sleep(0.1)
    except OSError:
        pass  # fail open: speak still works, just no listening


def _register_agent() -> None:
    """Announce this agent to the daemon so it appears in the switcher.

    In per-session mode the hook registers the agent (it knows session_id);
    this only fires for explicit GROK_VOICE_AGENT_NAME (per-config mode).
    """
    name = os.environ.get("GROK_VOICE_AGENT_NAME", "").strip()
    if not name:
        return
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    try:
        httpx.post(
            f"http://127.0.0.1:{port}/register", json={"name": name}, timeout=1.0
        )
    except httpx.HTTPError:
        pass


def main() -> None:
    _ensure_daemon()
    _register_agent()
    mcp.run()


if __name__ == "__main__":
    main()
