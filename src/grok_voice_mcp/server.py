"""MCP server that lets the assistant speak to the user via Grok Voice."""

import asyncio
import os
import re

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

mcp = FastMCP("grok-voice")


async def _listener_post(path: str, body: dict | None = None) -> None:
    """Best-effort call to the listener daemon; silent no-op when it's down."""
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            await client.post(f"http://127.0.0.1:{port}{path}", json=body)
    except httpx.HTTPError:
        pass


async def _dashboard_event(kind: str, detail: str, **extra: int) -> None:
    await _listener_post("/event", {"kind": kind, "detail": detail, **extra})


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


async def _render_and_play(text: str, voice_id: str, language: str, speed: float) -> str:
    """Synthesize `text` and play it, serialized behind any current speech."""
    status = await _daemon_status()
    resolved_voice = voice_id or os.environ.get(DEFAULT_VOICE_ENV_VAR, FALLBACK_VOICE)
    # Hybrid language: an explicit request arg wins for this one utterance;
    # else the dashboard's choice IF it has set one (including "" = auto,
    # which is a real choice — pass it through as "auto"); else env fallback.
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

        # Mute the listener while we play, or the mic transcribes our own speech.
        await _listener_post("/pause")
        await _listener_post("/speaking", {"speaking": True})
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
            await _listener_post("/speaking", {"speaking": False})
            await _listener_post("/resume")
        await _dashboard_event("speak_done", f"głos '{resolved_voice}'")
    return resolved_voice


@mcp.tool()
async def list_voices() -> list[dict]:
    """List the Grok TTS voices available for the speak tool."""
    return await tts.list_voices()


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
