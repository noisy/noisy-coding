"""MCP server that lets the assistant speak to the user via Grok Voice."""

import asyncio
import json
import os
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
from mcp.server.fastmcp import FastMCP

from grok_voice_mcp import playback, tts, tts_stream

DEFAULT_VOICE_ENV_VAR = "GROK_VOICE_DEFAULT_VOICE"
DEFAULT_LANGUAGE_ENV_VAR = "GROK_VOICE_DEFAULT_LANGUAGE"
LISTENER_PORT_ENV_VAR = "GROK_VOICE_LISTENER_PORT"
FALLBACK_VOICE = "eve"
FALLBACK_LANGUAGE = "en"
ECHO_TAIL_SECONDS = 0.25
EMPHASIS_PATTERN = re.compile(r"\*\*(.+?)\*\*")

# Serialize speech: only one utterance may play at a time. Without this two
# speak calls (e.g. one straddling an MCP reconnect) start players in
# parallel and talk over each other.
_speak_lock = asyncio.Lock()


def _emphasis_to_speech_tags(text: str) -> str:
    """Markdown **bold** becomes vocal emphasis for the TTS engine."""
    return EMPHASIS_PATTERN.sub(r"<loud>\1</loud>", text)


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


async def _listener_post(path: str, body: dict | None = None) -> None:
    """Best-effort call to the listener daemon; silent no-op when it's down."""
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            await client.post(f"http://127.0.0.1:{port}{path}", json=body)
    except httpx.HTTPError:
        pass


async def _acquire_floor(agent: str, timeout_s: float = 30.0) -> None:
    """Poll the daemon's cross-agent speaking floor until granted or timeout.

    Timing out and speaking anyway is better than never speaking; the worst
    case is a brief overlap, which the floor makes rare, not impossible.
    """
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    deadline = asyncio.get_event_loop().time() + timeout_s
    while asyncio.get_event_loop().time() < deadline:
        try:
            async with httpx.AsyncClient(timeout=0.5) as client:
                r = await client.post(
                    f"http://127.0.0.1:{port}/floor/acquire", json={"agent": agent}
                )
                if r.json().get("granted"):
                    return
        except (httpx.HTTPError, ValueError):
            return  # daemon down → don't block speech
        await asyncio.sleep(0.25)


async def _dashboard_event(kind: str, detail: str, **extra: object) -> None:
    # Tag the event with our agent so Claude's card lands in the right
    # per-agent history even if another agent became active meanwhile.
    agent = _agent_name()
    body = {"kind": kind, "detail": detail, **extra}
    if agent:
        body["agent"] = agent
    await _listener_post("/event", body)


async def _daemon_status() -> dict:
    """Best-effort snapshot of the listener daemon's settings ({} if down)."""
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            return (await client.get(f"http://127.0.0.1:{port}/status")).json()
    except (httpx.HTTPError, ValueError):
        return {}


def _tts_streaming_from(status: dict) -> bool:
    """Whether to stream TTS: env override wins, else the daemon's tts_mode."""
    if os.environ.get("GROK_VOICE_TTS_MODE", "").lower() == "live":
        return True
    return status.get("tts_mode") == "live"


@mcp.tool()
async def speak(
    text: str,
    voice_id: str = "",
    language: str = "",
    speed: float = 1.0,
    interrupt: bool = False,
) -> str:
    """Speak a short message aloud to the user through their speakers.

    Use this to deliver a spoken TL;DR alongside (not instead of) your written
    answer: 1-3 conversational sentences summarizing the outcome, a finding,
    or a question. Never read code, file paths, or long explanations aloud.

    Concurrent speech is serialized: by default a new call WAITS for the
    current utterance to finish (queued). Set interrupt=True to cut the
    current utterance off and speak immediately — use it only when your
    previous words are now stale (e.g. the user corrected you mid-answer).

    Args:
        text: What to say. Plain conversational prose. Mark the key words the
            listener must catch with markdown bold (**like this**) — they get
            vocal emphasis and show bold on the live dashboard. Also supports
            inline speech tags like [pause] or [laugh] and wrapping tags like
            <soft>text</soft>.
        voice_id: Grok voice to use (see list_voices). Empty = server default.
        language: BCP-47 code such as "en" or "pl", or "auto". Empty = server default.
        speed: Speech rate multiplier, 0.7-1.5.
        interrupt: Cut off any utterance currently playing and speak now.
    """
    if interrupt:
        playback.stop_all_players()  # cut the current utterance; lock releases
    resolved_voice = await _render_and_play(text, voice_id, language, speed)
    return f"Spoke the message aloud with voice '{resolved_voice}'."


_announce_tasks: set[asyncio.Task] = set()


@mcp.tool()
async def announce(text: str, voice_id: str = "", language: str = "", speed: float = 1.0) -> str:
    """Speak a quick spoken update WITHOUT waiting for it to finish.

    Fire-and-forget: use this to tell the user what you just did and keep
    working ("done with X, moving on") — it returns immediately and plays in
    the background, queued behind any current speech. Use `speak` instead when
    you are asking a question or otherwise waiting for the user's reply.
    """
    task = asyncio.create_task(_render_and_play(text, voice_id, language, speed))
    _announce_tasks.add(task)  # keep a strong ref so it isn't GC'd mid-play
    task.add_done_callback(_announce_tasks.discard)
    return "Announcement queued; playing in the background."


async def _fetch_character() -> dict:
    """This agent's character from the daemon (voice/speed/traits)."""
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    agent = _agent_name()
    query = f"?agent={agent}" if agent else ""
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            resp = await client.get(f"http://127.0.0.1:{port}/character{query}")
            return resp.json().get("character") or {}
    except (httpx.HTTPError, ValueError):
        return {}


async def _render_and_play(text: str, voice_id: str, language: str, speed: float) -> str:
    """Synthesize `text` and play it, serialized behind any current speech."""
    status = await _daemon_status()
    character = await _fetch_character()
    # Hybrid resolution for voice/speed/language: an explicit request arg wins
    # for this one utterance; else the dashboard's Character/Settings value;
    # else the env/fallback default. Keeps the dashboard the source of truth.
    resolved_voice = (
        voice_id
        or character.get("voice")
        or os.environ.get(DEFAULT_VOICE_ENV_VAR, FALLBACK_VOICE)
    )
    if speed == 1.0 and character.get("speed"):
        speed = float(character["speed"])  # dashboard speed unless call overrode it
    if language:
        resolved_language = language
    elif "language" in status:
        resolved_language = status["language"] or "auto"
    else:
        resolved_language = os.environ.get(DEFAULT_LANGUAGE_ENV_VAR, FALLBACK_LANGUAGE)

    async with _speak_lock:  # queue behind any utterance still playing
        await _dashboard_event("speak", f"[{resolved_voice}] „{text}”", chars=len(text))
        speech_text = _emphasis_to_speech_tags(text)
        streaming = _tts_streaming_from(status)

        agent_name = _agent_name() or None
        # Global floor: with multiple agents (separate MCP servers) the per-
        # process lock can't stop two voices overlapping. Wait for the daemon's
        # cross-agent floor before playing; time out so we never deadlock.
        if agent_name:
            await _acquire_floor(agent_name)
        # Mute the listener while we play, or the mic transcribes our own speech.
        await _listener_post("/pause")
        await _listener_post("/speaking", {"speaking": True, "agent": agent_name})
        try:
            if streaming:
                await _dashboard_event("speak_audio", "streaming from Grok TTS")
                await tts_stream.speak_streaming(
                    speech_text, resolved_voice, resolved_language, speed
                )
            else:
                audio = await tts.synthesize(
                    speech_text, resolved_voice, resolved_language, speed
                )
                await _dashboard_event(
                    "speak_audio", f"{len(audio.audio) / 1024:.0f} kB MP3 from Grok TTS"
                )
                await playback.play(audio.audio, audio.content_type)
            await asyncio.sleep(ECHO_TAIL_SECONDS)
        finally:
            await _listener_post("/speaking", {"speaking": False, "agent": agent_name})
            await _listener_post("/resume")
            if agent_name:
                await _listener_post("/floor/release", {"agent": agent_name})
        await _dashboard_event("speak_done", f"głos '{resolved_voice}'")
    return resolved_voice


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
