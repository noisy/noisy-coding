"""Client for the Grok (xAI) batch text-to-speech API."""

import base64
import os
from dataclasses import dataclass

import httpx

XAI_API_BASE = "https://api.x.ai/v1"
API_KEY_ENV_VAR = "XAI_API_KEY"
REQUEST_TIMEOUT_SECONDS = 60.0
MAX_TEXT_LENGTH = 15_000


class GrokTTSError(RuntimeError):
    """Raised when the Grok TTS API cannot produce audio."""


@dataclass(frozen=True)
class SynthesizedAudio:
    audio: bytes
    content_type: str
    duration_seconds: float


def _api_key() -> str:
    api_key = os.environ.get(API_KEY_ENV_VAR)
    if not api_key:
        raise GrokTTSError(
            f"{API_KEY_ENV_VAR} is not set. Configure it in the MCP server environment."
        )
    return api_key


async def synthesize(
    text: str,
    voice_id: str,
    language: str,
    speed: float,
) -> SynthesizedAudio:
    if len(text) > MAX_TEXT_LENGTH:
        raise GrokTTSError(
            f"Text is {len(text)} characters; the API accepts at most {MAX_TEXT_LENGTH}."
        )

    payload = {
        "text": text,
        "voice_id": voice_id,
        "language": language,
        "speed": speed,
        "output_format": {"codec": "mp3"},
    }
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{XAI_API_BASE}/tts",
            headers={"Authorization": f"Bearer {_api_key()}"},
            json=payload,
        )

    if response.status_code != httpx.codes.OK:
        raise GrokTTSError(
            f"Grok TTS request failed with HTTP {response.status_code}: {response.text[:500]}"
        )

    body = response.json()
    return SynthesizedAudio(
        audio=base64.b64decode(body["audio"]),
        content_type=body.get("content_type", "audio/mpeg"),
        duration_seconds=body.get("duration", 0.0),
    )


async def list_voices() -> list[dict]:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.get(
            f"{XAI_API_BASE}/tts/voices",
            headers={"Authorization": f"Bearer {_api_key()}"},
        )

    if response.status_code != httpx.codes.OK:
        raise GrokTTSError(
            f"Grok voices request failed with HTTP {response.status_code}: {response.text[:500]}"
        )

    body = response.json()
    return body.get("voices", body) if isinstance(body, dict) else body
