"""What each provider needs from the user — data for a generic setup UI.

First-contact today hardwires "paste your xAI key". With multiple
engines the dashboard must instead ask "which provider?" first, then
render THAT provider's own requirements — so every provider declares
them here as plain data. The dashboard renders fields it has never
heard of; adding a provider never means new frontend code.

Field kinds the UI understands:
  - "secret": a credential (masked input, stored via its `store`)
  - "choice": pick one of `options`
  - "text":   free-form value

`ready` says whether the provider could work right now (key present,
optional dependency installed, binary on PATH) — the chooser can gray
out or badge entries accordingly.
"""

import shutil
from importlib.util import find_spec
from typing import Any

from noisy_coding import credentials
from noisy_coding.providers import config


def catalog() -> list[dict[str, Any]]:
    """Every known provider, its capabilities and setup requirements."""
    return [
        {
            "name": "grok",
            "kind": "cloud-api",  # third-party API: expects a key, costs money
            "label": "Grok (xAI)",
            "directions": ["tts", "stt"],
            "streaming": {"tts": True, "stt": True},
            "ready": bool(credentials.api_key()),
            "fields": [
                {
                    "key": "xai_api_key",
                    "kind": "secret",
                    "label": "xAI API key",
                    "required": True,
                    "hint": credentials.api_key_hint(),
                },
            ],
        },
        {
            "name": "local",
            "kind": "local",  # on-device: no key, picks a model instead
            "label": "Local (offline)",
            "directions": ["tts", "stt"],
            "streaming": {"tts": False, "stt": False},
            "ready": _local_ready(),
            "fields": [
                {
                    "key": "stt_model",
                    "kind": "choice",
                    "label": "Whisper model",
                    "required": False,
                    "options": ["tiny", "base", "small", "medium", "large-v3"],
                    "value": str(
                        config.local_options().get("stt_model")
                        or config.DEFAULT_LOCAL_STT_MODEL
                    ),
                },
                {
                    "key": "tts_voice",
                    "kind": "text",
                    "label": "System voice (empty = default)",
                    "required": False,
                    "value": str(config.local_options().get("tts_voice") or ""),
                },
            ],
        },
    ]


def _local_ready() -> bool:
    """STT needs faster-whisper installed; TTS needs the `say` binary."""
    return find_spec("faster_whisper") is not None and bool(shutil.which("say"))
