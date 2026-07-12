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
ECHO_TAIL_SECONDS = 0.25
# Don't start speaking while the user is mid-utterance: it talks over them
# and, worse, the mic is muted while we play so their words are lost
# entirely. Watch the recording flag and hold until they finish. The cap
# only guards against a stuck recording flag (wedged VAD) — it must be far
# longer than any real monologue, or it fires mid-speech and we barge in
# exactly the way this gate exists to prevent. It still fits within the MCP
# server's 180s HTTP timeout for /speak.
WAIT_FOR_USER_POLL_SECONDS = 0.05
WAIT_FOR_USER_TIMEOUT_SECONDS = 120.0
# After the user's speech ends, wait for a brief lull before speaking — a
# short pause mid-thought (breath) shouldn't be read as "your turn now".
USER_DONE_SETTLE_SECONDS = 0.6
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


def _wait_until_user_done(
    state: ListenerState,
    timeout_s: float = WAIT_FOR_USER_TIMEOUT_SECONDS,
    settle_s: float = USER_DONE_SETTLE_SECONDS,
) -> None:
    """Hold until the user isn't speaking, so we never talk over them."""
    deadline = time.monotonic() + timeout_s
    quiet_since: float | None = None
    while time.monotonic() < deadline:
        if state.recording:
            quiet_since = None
        else:
            if quiet_since is None:
                quiet_since = time.monotonic()
            if time.monotonic() - quiet_since >= settle_s:
                return  # quiet long enough — the user's turn is over
        time.sleep(WAIT_FOR_USER_POLL_SECONDS)


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
    # Wait out any in-progress user utterance before we mute the mic to
    # play — otherwise we talk over them and their words are lost.
    _wait_until_user_done(state)

    detail = f"[{resolved_voice}] „{text}”"
    state.add_event("speak", detail)
    utterance_id = state.create_utterance(
        "claude", "synthesizing (Grok TTS)…", text=detail, agent=agent
    )
    cost = pricing.tts_cost_usd(len(text))
    state.add_cost("claude", cost)
    state.update_utterance(utterance_id, cost_usd=cost)

    speech_text = _emphasis_to_speech_tags(text)
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
        state.add_event("speak_error", str(error)[:200])
        state.update_utterance(utterance_id, status="error")
        raise
    finally:
        state.set_claude_speaking(False, agent)
        state.set_paused(False)
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
