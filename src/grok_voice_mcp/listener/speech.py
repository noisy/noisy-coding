"""Render TTS and play it aloud — the daemon's side of speak/announce.

All speech flows through one single-worker executor: the queue itself
serializes utterances across every agent and MCP server process, which is
what used to require the cross-agent floor. The worker thread runs the
async TTS/playback modules via asyncio.run.
"""

import asyncio
import os
import re
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor

from grok_voice_mcp import playback, tts, tts_stream
from grok_voice_mcp.listener import tab_audio
from grok_voice_mcp.listener import pricing
from grok_voice_mcp.listener.state import ListenerState

DEFAULT_VOICE_ENV_VAR = "GROK_VOICE_DEFAULT_VOICE"
DEFAULT_LANGUAGE_ENV_VAR = "GROK_VOICE_DEFAULT_LANGUAGE"
TTS_MODE_ENV_VAR = "GROK_VOICE_TTS_MODE"
FALLBACK_VOICE = "eve"
# Physical echo guard, not turn-taking: the room's sound tail after the
# player exits would land in the just-unmuted mic and get transcribed.
ECHO_TAIL_SECONDS = 0.25
# Conversational courtesy (Krzysztof's spec: "~2s max"): when his utterance
# has JUST ended, give him a beat to tack on a follow-up thought before we
# take the speaker. Counts from the actual end of recording, so speech long
# after silence starts instantly.
POST_TURN_GRACE_SECONDS = 1.5
EMPHASIS_PATTERN = re.compile(r"\*\*(.+?)\*\*")

# One worker = one utterance at a time; every speak in the whole system
# queues here, so two voices can never overlap.
_playback_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="playback")

# An old message either plays or it doesn't — replays of the same bubble
# must not stack up in the queue when the user clicks repeatedly. New
# speech (fresh cards) may queue freely; a replay source may be in flight
# only once.
_pending_replays: set[int] = set()
_pending_lock = threading.Lock()


def submit(
    state: ListenerState,
    text: str,
    agent: str | None = None,
    card: bool = True,
    source_id: int = 0,
) -> Future | None:
    """Queue an utterance for playback; resolves to the voice actually used.

    Requests carry only text — voice, speed and language are the daemon's
    business (see resolve_options), so a stale caller can't override what
    the user configured on the dashboard.

    The dashboard card is created HERE, at enqueue: the timeline shows when
    Claude decided to speak (creation order) — a reply composed before the
    user's last words shouldn't display as if it answered them. Delivery
    order lives in the card's status (queued → waiting → playing → played).
    card=False plays without a card — replaying an old bubble shouldn't
    duplicate it in the log (utterance_id 0 makes every update a no-op).
    Returns None when this source is already queued/playing (deduped).
    """
    if source_id:
        with _pending_lock:
            if source_id in _pending_replays:
                return None
            _pending_replays.add(source_id)
    # Plain text on the card — no decorative quotes, no voice tag.
    # A replay (card=False) adopts the ORIGINAL card via source_id: its
    # status walks the normal chain (synthesizing → playing → played), so
    # an UNHEARD card becomes played once caught up on.
    utterance_id = (
        state.create_utterance("claude", "queued", text=text, agent=agent)
        if card
        else source_id
    )
    # Which card the playback "belongs to" on the dashboard: a replay
    # (card=False) points back at the original bubble via source_id, so the
    # UI can offer STOP on it while it plays.
    future = _playback_executor.submit(
        _render_and_play, state, text, agent, utterance_id, source_id or utterance_id
    )
    if source_id:
        future.add_done_callback(lambda _f: _discard_pending_replay(source_id))
    return future


def _discard_pending_replay(source_id: int) -> None:
    with _pending_lock:
        _pending_replays.discard(source_id)


def shutdown() -> None:
    _playback_executor.shutdown(wait=False)


def _emphasis_to_speech_tags(text: str) -> str:
    """Markdown **bold** becomes vocal emphasis for the TTS engine."""
    return EMPHASIS_PATTERN.sub(r"<loud>\1</loud>", text)


def resolve_options(
    state: ListenerState, agent: str | None = None
) -> tuple[str, str, float]:
    """Voice/language/speed for an utterance — decided by the daemon alone.

    The dashboard's per-agent character supplies voice and speed, the
    daemon's language setting supplies language, env vars are the fallback.
    Speak requests carry none of this by design; an agent that wants a
    different voice must change its character (the `change_voice` tool /
    POST /voice), which the user then sees on the dashboard.
    """
    character = state.character(agent)
    voice = character.get("voice") or os.environ.get(DEFAULT_VOICE_ENV_VAR, FALLBACK_VOICE)
    language = state.language or os.environ.get(DEFAULT_LANGUAGE_ENV_VAR) or "auto"
    speed = float(character.get("speed") or 1.0)
    return voice, language, speed


def _log(message: str) -> None:
    print(message, flush=True)


def _hold_for_user_turn(state: ListenerState, utterance_id: int) -> None:
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
        state.update_utterance(utterance_id, status="queued — waiting for you to finish")
        _log(f"[speak] {detail}")
    held_since = time.monotonic()
    state.wait_for_user_silence(grace_s=POST_TURN_GRACE_SECONDS)
    if user_was_speaking:
        _log(f"[speak] user finished — held playback {time.monotonic() - held_since:.1f}s")


def _tts_streaming(state: ListenerState) -> bool:
    """Whether to stream TTS: env override wins, else the daemon's tts_mode."""
    if state.output_device == "browser":
        # The tab plays one complete clip per message (v1) — streaming
        # chunks over the bridge is a later iteration.
        return False
    if os.environ.get(TTS_MODE_ENV_VAR, "").lower() == "live":
        return True
    return state.tts_mode == "live"


def _render_and_play(
    state: ListenerState,
    text: str,
    agent: str | None,
    utterance_id: int,
    source_id: int,
) -> str:
    """Synthesize `text` and play it. Runs on the single playback worker."""
    resolved_voice, resolved_language, resolved_speed = resolve_options(state, agent)
    if state.voice_muted:
        # Speaker muted (user away / wants quiet): park the message as
        # UNHEARD — no synthesis (deferred = costs nothing until played),
        # and return at once so agents' blocking speak never hangs on it.
        _log(f"[speak] unheard (voice muted): „{text[:60]}”")
        state.add_event("speak_unheard", f"„{text}”")
        state.update_utterance(utterance_id, status="unheard — voice muted")
        return resolved_voice
    _hold_for_user_turn(state, utterance_id)

    # The event log keeps the voice (diagnostics); the card does NOT — a
    # replay speaks with the CURRENT voice, so a voice tag on the bubble
    # would go stale the moment the user picks another one.
    state.add_event("speak", f"[{resolved_voice}] „{text}”")
    cost = pricing.tts_cost_usd(len(text))
    state.add_cost("claude", cost)
    state.add_usage("tts_chars", len(text))
    state.update_utterance(utterance_id, status="synthesizing (Grok TTS)…", cost_usd=cost)

    speech_text = _emphasis_to_speech_tags(text)
    _log(f"[speak] playing [{resolved_voice}] ({len(text)} chars) „{text[:60]}”")
    playing_since = time.monotonic()
    # Claim the card BEFORE synthesis: the UI's button must flip to STOP as
    # soon as this playback is committed, not seconds later when audio starts.
    state.set_playing_utterance_id(source_id)
    # Mute the listener while we play, or the mic transcribes our own
    # speech — EXCEPT tab-in + tab-out: the browser's echo cancellation
    # removes Claude's voice from the capture, so the mic stays hot and
    # the user can talk right through the playback (barge-in).
    aec_covers_echo = (
        state.output_device == "browser" and state.input_device == "browser"
    )
    if not aec_covers_echo:
        state.set_paused(True)
    state.set_claude_speaking(True, agent)
    try:
        asyncio.run(
            _synthesize_and_play(
                state, speech_text, resolved_voice, resolved_language,
                resolved_speed, utterance_id,
            )
        )
        if not aec_covers_echo:  # nothing was muted — no echo tail to wait out
            time.sleep(ECHO_TAIL_SECONDS)  # let the room echo die before unmuting
    except Exception as error:
        _log(f"[speak] error: {error}")
        state.add_event("speak_error", str(error)[:200])
        state.update_utterance(utterance_id, status="error")
        raise
    finally:
        state.set_playing_utterance_id(0)
        state.set_claude_speaking(False, agent)
        if not aec_covers_echo:
            state.set_paused(False)
    played_seconds = time.monotonic() - playing_since
    _log(f"[speak] done in {played_seconds:.1f}s")
    state.add_event("speak_done", f"głos '{resolved_voice}'")
    state.update_utterance(
        utterance_id, status="played", duration_s=round(played_seconds, 1)
    )
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
        await tts_stream.speak_streaming(
            speech_text,
            voice,
            language,
            speed,
            on_first_audio=lambda seconds: state.set_latency("tts", seconds * 1000),
        )
    else:
        synth_started = time.monotonic()
        audio = await tts.synthesize(speech_text, voice, language, speed)
        state.set_latency("tts", (time.monotonic() - synth_started) * 1000)
        detail = f"{len(audio.audio) / 1024:.0f} kB MP3 from Grok TTS"
        if state.output_device == "browser":
            live_bridge = tab_audio.bridge()
            state.add_event("speak_audio", detail + " → browser tab")
            state.update_utterance(
                utterance_id, status="playing through speakers…",
                detail="playing in the browser tab",
            )
            if live_bridge is not None and await asyncio.to_thread(
                live_bridge.play_through_tab, audio.audio, audio.content_type
            ):
                return
            # No live tab took the clip — never lose speech: fall back to
            # the system speakers and say so in the event log.
            state.add_event("speak_fallback", "no browser tab — system speakers")
        state.add_event("speak_audio", detail)
        state.update_utterance(
            utterance_id, status="playing through speakers…", detail=detail
        )
        await playback.play(audio.audio, audio.content_type)
