"""MCP server that lets the assistant speak to the user via Grok Voice."""

import os

from mcp.server.fastmcp import FastMCP

from grok_voice_mcp import playback, tts

DEFAULT_VOICE_ENV_VAR = "GROK_VOICE_DEFAULT_VOICE"
DEFAULT_LANGUAGE_ENV_VAR = "GROK_VOICE_DEFAULT_LANGUAGE"
FALLBACK_VOICE = "eve"
FALLBACK_LANGUAGE = "en"

mcp = FastMCP("grok-voice")


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

    audio = await tts.synthesize(text, resolved_voice, resolved_language, speed)
    await playback.play(audio.audio, audio.content_type)
    return f"Spoke {audio.duration_seconds:.1f}s of audio with voice '{resolved_voice}'."


@mcp.tool()
async def list_voices() -> list[dict]:
    """List the Grok TTS voices available for the speak tool."""
    return await tts.list_voices()


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
