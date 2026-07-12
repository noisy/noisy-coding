"""Render TTS and play it aloud — the daemon's side of speak/announce.

All speech flows through one single-worker executor: the queue itself
serializes utterances across every agent and MCP server process, which is
what used to require the cross-agent floor. The worker thread runs the
async TTS/playback modules via asyncio.run.
"""

import asyncio
import os
import re
import time
from concurrent.futures import Future, ThreadPoolExecutor

from grok_voice_mcp import playback, tts, tts_stream
from grok_voice_mcp.listener import pricing
from grok_voice_mcp.listener.state import ListenerState

DEFAULT_VOICE_ENV_VAR = "GROK_VOICE_DEFAULT_VOICE"
DEFAULT_LANGUAGE_ENV_VAR = "GROK_VOICE_DEFAULT_LANGUAGE"
TTS_MODE_ENV_VAR = "GROK_VOICE_TTS_MODE"
FALLBACK_VOICE = "eve"
# Physical echo guard, not turn-taking: the room's sound tail after the
# player exits would land in the just-unmuted mic and get transcribed.
ECHO_TAIL_SECONDS = 0.25
EMPHASIS_PATTERN = re.compile(r"\*\*(.+?)\*\*")

# One worker = one utterance at a time; every speak in the whole system
# queues here, so two voices can never overlap.
_playback_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="playback")


def submit(
    state: ListenerState,
    text: str,
    voice_id: str = "",
    language: str = "",
    speed: float = 1.0,
    agent: str | None = None,
) -> Future:
    """Queue an utterance for playback; resolves to the voice actually used."""
    return _playback_executor.submit(
        _render_and_play, state, text, voice_id, language, speed, agent
    )


def shutdown() -> None:
    _playback_executor.shutdown(wait=False)


def _emphasis_to_speech_tags(text: str) -> str:
    """Markdown **bold** becomes vocal emphasis for the TTS engine."""
    return EMPHASIS_PATTERN.sub(r"<loud>\1</loud>", text)


def resolve_options(
    state: ListenerState,
    voice_id: str,
    language: str,
    speed: float,
    agent: str | None = None,
) -> tuple[str, str, float]:
    """Hybrid resolution for voice/language/speed.

    An explicit request arg wins for this one utterance; else the
    dashboard's Character/Settings value; else the env default. Keeps the
    dashboard the source of truth.
    """
    character = state.character(agent)
    resolved_voice = (
        voice_id
        or character.get("voice")
        or os.environ.get(DEFAULT_VOICE_ENV_VAR, FALLBACK_VOICE)
    )
    resolved_language = (
        language or state.language or os.environ.get(DEFAULT_LANGUAGE_ENV_VAR) or "auto"
    )
    if speed == 1.0 and character.get("speed"):
        speed = float(character["speed"])  # dashboard speed unless call overrode it
    return resolved_voice, resolved_language, speed


def _log(message: str) -> None:
    print(message, flush=True)


def _hold_for_user_turn(state: ListenerState) -> None:
    """Wait out an in-progress user utterance before taking the speaker.

    Speaking now would talk over the user AND lose their words (the mic is
    muted during playback). The daemon's VAD alone decides when their turn
    is over — no debounce, no timeout, no polling; see
    ListenerState.wait_for_user_silence for why this can't deadlock.
    """
    user_was_speaking = state.recording
    if user_was_speaking:
        detail = "user is speaking — holding playback"
        state.add_event("speak_wait", detail)
        _log(f"[speak] {detail}")
    held_since = time.monotonic()
    state.wait_for_user_silence()
    if user_was_speaking:
        _log(f"[speak] user finished — held playback {time.monotonic() - held_since:.1f}s")


def _tts_streaming(state: ListenerState) -> bool:
    """Whether to stream TTS: env override wins, else the daemon's tts_mode."""
    if os.environ.get(TTS_MODE_ENV_VAR, "").lower() == "live":
        return True
    return state.tts_mode == "live"


def _render_and_play(
    state: ListenerState,
    text: str,
    voice_id: str,
    language: str,
    speed: float,
    agent: str | None,
) -> str:
    """Synthesize `text` and play it. Runs on the single playback worker."""
    resolved_voice, resolved_language, resolved_speed = resolve_options(
        state, voice_id, language, speed, agent
    )
    _hold_for_user_turn(state)

    detail = f"[{resolved_voice}] „{text}”"
    state.add_event("speak", detail)
    utterance_id = state.create_utterance(
        "claude", "synthesizing (Grok TTS)…", text=detail, agent=agent
    )
    cost = pricing.tts_cost_usd(len(text))
    state.add_cost("claude", cost)
    state.update_utterance(utterance_id, cost_usd=cost)

    speech_text = _emphasis_to_speech_tags(text)
    _log(f"[speak] playing [{resolved_voice}] ({len(text)} chars) „{text[:60]}”")
    playing_since = time.monotonic()
    # Mute the listener while we play, or the mic transcribes our own speech.
    state.set_paused(True)
    state.set_claude_speaking(True, agent)
    try:
        asyncio.run(
            _synthesize_and_play(
                state, speech_text, resolved_voice, resolved_language,
                resolved_speed, utterance_id,
            )
        )
        time.sleep(ECHO_TAIL_SECONDS)  # let the room echo die before unmuting
    except Exception as error:
        _log(f"[speak] error: {error}")
        state.add_event("speak_error", str(error)[:200])
        state.update_utterance(utterance_id, status="error")
        raise
    finally:
        state.set_claude_speaking(False, agent)
        state.set_paused(False)
    _log(f"[speak] done in {time.monotonic() - playing_since:.1f}s")
    state.add_event("speak_done", f"głos '{resolved_voice}'")
    state.update_utterance(utterance_id, status="played")
    return resolved_voice


async def _synthesize_and_play(
    state: ListenerState,
    speech_text: str,
    voice: str,
    language: str,
    speed: float,
    utterance_id: int,
) -> None:
    if _tts_streaming(state):
        detail = "streaming from Grok TTS"
        state.add_event("speak_audio", detail)
        state.update_utterance(
            utterance_id, status="playing through speakers…", detail=detail
        )
        await tts_stream.speak_streaming(speech_text, voice, language, speed)
    else:
        audio = await tts.synthesize(speech_text, voice, language, speed)
        detail = f"{len(audio.audio) / 1024:.0f} kB MP3 from Grok TTS"
        state.add_event("speak_audio", detail)
        state.update_utterance(
            utterance_id, status="playing through speakers…", detail=detail
        )
        await playback.play(audio.audio, audio.content_type)
