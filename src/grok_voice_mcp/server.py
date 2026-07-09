"""MCP server that lets the assistant speak to the user via Grok Voice."""

import asyncio
import os

import httpx
from mcp.server.fastmcp import FastMCP

from grok_voice_mcp import playback, tts

DEFAULT_VOICE_ENV_VAR = "GROK_VOICE_DEFAULT_VOICE"
DEFAULT_LANGUAGE_ENV_VAR = "GROK_VOICE_DEFAULT_LANGUAGE"
LISTENER_PORT_ENV_VAR = "GROK_VOICE_LISTENER_PORT"
FALLBACK_VOICE = "eve"
FALLBACK_LANGUAGE = "en"
ECHO_TAIL_SECONDS = 0.5

mcp = FastMCP("grok-voice")


async def _listener_post(path: str, body: dict | None = None) -> None:
    """Best-effort call to the listener daemon; silent no-op when it's down."""
    port = os.environ.get(LISTENER_PORT_ENV_VAR, "8765")
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            await client.post(f"http://127.0.0.1:{port}{path}", json=body)
    except httpx.HTTPError:
        pass


async def _dashboard_event(kind: str, detail: str) -> None:
    await _listener_post("/event", {"kind": kind, "detail": detail})


@mcp.tool()
async def speak(text: str, voice_id: str = "", language: str = "", speed: float = 1.0) -> str:
    """Speak a short message aloud to the user through their speakers.

    Use this to deliver a spoken TL;DR alongside (not instead of) your written
    answer: 1-3 conversational sentences summarizing the outcome, a finding,
    or a question. Never read code, file paths, or long explanations aloud.

    Args:
        text: What to say. Plain conversational prose. Supports inline speech
            tags like [pause] or [laugh] and wrapping tags like <soft>text</soft>.
        voice_id: Grok voice to use (see list_voices). Empty = server default.
        language: BCP-47 code such as "en" or "pl", or "auto". Empty = server default.
        speed: Speech rate multiplier, 0.7-1.5.
    """
    resolved_voice = voice_id or os.environ.get(DEFAULT_VOICE_ENV_VAR, FALLBACK_VOICE)
    resolved_language = language or os.environ.get(DEFAULT_LANGUAGE_ENV_VAR, FALLBACK_LANGUAGE)

    await _dashboard_event("speak", f"[{resolved_voice}] „{text}”")
    audio = await tts.synthesize(text, resolved_voice, resolved_language, speed)
    await _dashboard_event("speak_audio", f"{len(audio.audio) / 1024:.0f} kB MP3 z Grok TTS")
    # Mute the listener while we play, or the mic transcribes our own speech.
    await _listener_post("/pause")
    try:
        await playback.play(audio.audio, audio.content_type)
        await asyncio.sleep(ECHO_TAIL_SECONDS)
    finally:
        await _listener_post("/resume")
    await _dashboard_event("speak_done", f"głos '{resolved_voice}'")
    return f"Spoke the message aloud with voice '{resolved_voice}'."


@mcp.tool()
async def list_voices() -> list[dict]:
    """List the Grok TTS voices available for the speak tool."""
    return await tts.list_voices()


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
