"""Fully local voice — no API key, no cloud round-trip, no per-minute cost.

STT: faster-whisper (CTranslate2 Whisper), an optional dependency:

    uv sync --extra local        # or: pip install 'noisy-coding[local]'

The model (default "small", override in providers.json under
local.stt_model) downloads from Hugging Face on first use and is cached
by faster-whisper; every later transcription is offline. The model is
loaded once per process and reused — loading is the expensive part.

TTS: the macOS `say` engine — zero extra dependencies, works offline.
Not a beauty-contest voice, but a correct, free fallback that proves the
provider seam; Piper/Kokoro can slot in behind the same interface later
(see issue #37 for candidates, including NVIDIA Nemotron for STT).

Streaming: neither direction streams yet (supports_streaming = False);
the daemon's batch paths carry local mode. Whisper partials are feasible
later by transcribing the growing buffer.
"""

import asyncio
import io
import tempfile
import threading
import wave
from collections.abc import Callable
from pathlib import Path

import numpy as np

from noisy_coding.providers import config
from noisy_coding.providers.base import (
    STTError,
    STTStreamSession,
    SynthesizedAudio,
    TTSError,
)

_INSTALL_HINT = (
    "Local STT needs the optional faster-whisper dependency — install it "
    "with: uv sync --extra local (or pip install faster-whisper)."
)


class LocalSTT:
    name = "local"
    label = "local STT (whisper)"
    supports_streaming = False

    _model = None
    _model_name = ""
    _lock = threading.Lock()

    def _load_model(self):
        model_name = str(
            config.local_options().get("stt_model") or config.DEFAULT_LOCAL_STT_MODEL
        )
        with LocalSTT._lock:
            if LocalSTT._model is None or LocalSTT._model_name != model_name:
                try:
                    from faster_whisper import WhisperModel
                except ImportError as error:
                    raise STTError(_INSTALL_HINT) from error
                LocalSTT._model = WhisperModel(
                    model_name, device="auto", compute_type="auto"
                )
                LocalSTT._model_name = model_name
            return LocalSTT._model

    def transcribe(self, wav_bytes: bytes, language: str = "") -> str:
        model = self._load_model()
        samples = _wav_to_float32(wav_bytes)
        try:
            segments, _info = model.transcribe(
                samples,
                language=language or None,
                vad_filter=True,  # cheap guard against pure-noise utterances
            )
            return " ".join(segment.text.strip() for segment in segments).strip()
        except Exception as error:
            raise STTError(f"Local transcription failed: {error}") from error

    def open_stream(
        self,
        sample_rate: int,
        language: str,
        on_partial: Callable[[str], None],
        smart_turn: float = 0.0,
        on_turn_end: Callable[[], None] | None = None,
    ) -> STTStreamSession | None:
        return None  # batch fallback

    def cost_usd(self, audio_seconds: float) -> float:
        return 0.0

    def streaming_cost_usd(self, audio_seconds: float) -> float:
        return 0.0


def _wav_to_float32(wav_bytes: bytes) -> np.ndarray:
    """Whisper wants mono float32 at 16 kHz — the daemon's native rate.

    The VAD already pulls devices to 16 kHz mono int16 (vad.py), so no
    resampling here; assert the assumption instead of silently degrading.
    """
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
        rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if rate != 16_000:
        # Linear resample in software — never touch the device's rate.
        target_length = int(len(samples) * 16_000 / rate)
        samples = np.interp(
            np.linspace(0.0, len(samples) - 1, target_length),
            np.arange(len(samples)),
            samples,
        ).astype(np.float32)
    return samples


class LocalTTS:
    name = "local"
    label = "local TTS (say)"
    supports_streaming = False

    async def synthesize(
        self, text: str, voice_id: str, language: str, speed: float
    ) -> SynthesizedAudio:
        voice = str(config.local_options().get("tts_voice") or "")
        # `say` rate is words per minute; ~180 wpm reads as speed 1.0.
        rate = max(90, min(360, int(180 * speed)))
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out:
            path = Path(out.name)
        command = ["say", "-o", str(path), "--data-format=LEI16@22050", "-r", str(rate)]
        if voice:
            command += ["-v", voice]
        command.append(text)
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _stdout, stderr = await process.communicate()
            if process.returncode != 0:
                raise TTSError(
                    f"Local TTS (say) failed: {stderr.decode(errors='replace')[:300]}"
                )
            return SynthesizedAudio(path.read_bytes(), "audio/wav", 0.0)
        except FileNotFoundError as error:
            raise TTSError(
                "Local TTS needs the macOS `say` command; not found on this system."
            ) from error
        finally:
            path.unlink(missing_ok=True)

    async def speak_streaming(self, *args, **kwargs) -> None:
        raise TTSError("Local TTS does not stream — use the batch path.")

    async def list_voices(self) -> list[dict]:
        try:
            result = await asyncio.create_subprocess_exec(
                "say", "-v", "?",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await result.communicate()
        except FileNotFoundError:
            return []
        voices = []
        for line in stdout.decode(errors="replace").splitlines():
            # "Samantha            en_US    # Hello! ..." — name may hold spaces.
            head = line.split("#")[0].rstrip()
            if not head:
                continue
            name, _, locale = head.rpartition(" ")
            voices.append({"voice_id": name.rstrip(), "language": locale})
        return voices

    def cost_usd(self, text_chars: int) -> float:
        return 0.0
