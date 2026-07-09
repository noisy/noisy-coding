"""Streaming text-to-speech over the Grok (xAI) TTS websocket.

Sends the whole text in one text.delta / text.done, then pipes the
returned audio.delta chunks straight into a player process (ffmpeg/mpv or
afplay via a temp file) so playback starts before synthesis finishes.
"""

import asyncio
import base64
import json
import os
import shutil
import tempfile
from pathlib import Path

import websockets

from grok_voice_mcp import tts

STREAM_URL_BASE = "wss://api.x.ai/v1/tts"


class GrokTTSStreamError(RuntimeError):
    """Raised when the streaming TTS session fails."""


def _stream_player_command() -> list[str] | None:
    """A player that can read an MP3 stream from stdin, or None if absent."""
    if shutil.which("ffplay"):
        return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", "-"]
    if shutil.which("mpv"):
        return ["mpv", "--no-video", "--really-quiet", "-"]
    return None


async def _play_from_stream(chunks: asyncio.Queue[bytes | None]) -> None:
    """Feed audio chunks into a streaming player as they arrive."""
    command = _stream_player_command()
    if command is None:
        # No stdin-streaming player (e.g. bare macOS): buffer to a temp file
        # and play once. Loses the streaming latency win but stays correct.
        await _play_buffered(chunks)
        return

    process = await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    assert process.stdin is not None
    while True:
        chunk = await chunks.get()
        if chunk is None:
            break
        process.stdin.write(chunk)
        await process.stdin.drain()
    process.stdin.close()
    await process.wait()


async def _play_buffered(chunks: asyncio.Queue[bytes | None]) -> None:
    buffer = bytearray()
    while True:
        chunk = await chunks.get()
        if chunk is None:
            break
        buffer.extend(chunk)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as audio_file:
        audio_file.write(buffer)
        path = Path(audio_file.name)
    try:
        process = await asyncio.create_subprocess_exec(
            "afplay", str(path),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await process.wait()
    finally:
        path.unlink(missing_ok=True)


async def speak_streaming(
    text: str, voice_id: str, language: str, speed: float
) -> None:
    """Synthesize and play `text`, streaming audio as it is generated."""
    api_key = tts._api_key()
    query = (
        f"language={language or 'auto'}&voice={voice_id}"
        f"&codec=mp3&speed={speed}&optimize_streaming_latency=1"
    )
    chunks: asyncio.Queue[bytes | None] = asyncio.Queue()

    try:
        async with websockets.connect(
            f"{STREAM_URL_BASE}?{query}",
            additional_headers={"Authorization": f"Bearer {api_key}"},
            open_timeout=10,
        ) as ws:
            await ws.send(json.dumps({"type": "text.delta", "delta": text}))
            await ws.send(json.dumps({"type": "text.done"}))

            player = asyncio.create_task(_play_from_stream(chunks))
            async for message in ws:
                if isinstance(message, bytes):
                    await chunks.put(message)
                    continue
                payload = json.loads(message)
                kind = payload.get("type")
                if kind == "audio.delta":
                    await chunks.put(base64.b64decode(payload["delta"]))
                elif kind == "audio.done":
                    break
                elif kind == "error":
                    raise GrokTTSStreamError(str(payload)[:300])
            await chunks.put(None)
            await player
    except (OSError, websockets.WebSocketException) as error:
        raise GrokTTSStreamError(f"Streaming TTS failed: {error}") from error


def streaming_available() -> bool:
    """True if a stdin-streaming player exists (else we buffer-and-play)."""
    return _stream_player_command() is not None or bool(
        os.environ.get("GROK_VOICE_ALLOW_BUFFERED_STREAM")
    )
