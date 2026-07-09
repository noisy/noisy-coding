"""Play synthesized audio through the local speakers."""

import asyncio
import shutil
import sys
import tempfile
from pathlib import Path

SUFFIX_BY_CONTENT_TYPE = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
}


class PlaybackError(RuntimeError):
    """Raised when no audio player is available or playback fails."""


def _player_command(audio_path: Path) -> list[str]:
    if sys.platform == "darwin":
        return ["afplay", str(audio_path)]
    for candidate in ("mpv", "ffplay"):
        if shutil.which(candidate):
            if candidate == "ffplay":
                return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", str(audio_path)]
            return ["mpv", "--no-video", "--really-quiet", str(audio_path)]
    raise PlaybackError("No audio player found (need afplay, mpv, or ffplay).")


async def play(audio: bytes, content_type: str) -> None:
    suffix = SUFFIX_BY_CONTENT_TYPE.get(content_type, ".mp3")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as audio_file:
        audio_file.write(audio)
        audio_path = Path(audio_file.name)

    try:
        process = await asyncio.create_subprocess_exec(
            *_player_command(audio_path),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0:
            raise PlaybackError(
                f"Audio player exited with code {process.returncode}: {stderr.decode(errors='replace')[:200]}"
            )
    finally:
        audio_path.unlink(missing_ok=True)
