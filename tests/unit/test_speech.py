import asyncio
import threading
import time

from grok_voice_mcp.listener import speech
from grok_voice_mcp.listener.state import ListenerState


def test_playback_queue_serializes_concurrent_speaks(monkeypatch):
    state = ListenerState()
    intervals = []

    async def fake_synthesize_and_play(*_args):
        start = time.monotonic()
        await asyncio.sleep(0.1)
        intervals.append((start, time.monotonic()))

    monkeypatch.setattr(speech, "_synthesize_and_play", fake_synthesize_and_play)
    monkeypatch.setattr(speech, "_wait_until_user_done", lambda *_a, **_k: None)
    monkeypatch.setattr(speech, "ECHO_TAIL_SECONDS", 0)

    futures = [speech.submit(state, f"utterance {i}") for i in range(2)]
    for future in futures:
        future.result(timeout=5)

    first_end = min(end for _, end in intervals)
    last_start = max(start for start, _ in intervals)
    assert last_start >= first_end


def test_wait_until_user_done_holds_while_the_user_is_speaking():
    state = ListenerState()
    state.set_recording(True)
    recording_stop_delay = 0.15

    def stop_recording_soon():
        time.sleep(recording_stop_delay)
        state.set_recording(False)

    threading.Thread(target=stop_recording_soon).start()
    start = time.monotonic()
    speech._wait_until_user_done(state, timeout_s=5.0, settle_s=0.05)
    elapsed = time.monotonic() - start

    assert elapsed >= recording_stop_delay


def test_wait_until_user_done_returns_after_settle_when_quiet():
    state = ListenerState()

    start = time.monotonic()
    speech._wait_until_user_done(state, timeout_s=5.0, settle_s=0.05)
    elapsed = time.monotonic() - start

    assert 0.05 <= elapsed < 1.0


def test_wait_until_user_done_gives_up_at_timeout_when_recording_never_stops():
    state = ListenerState()
    state.set_recording(True)

    start = time.monotonic()
    speech._wait_until_user_done(state, timeout_s=0.2, settle_s=0.05)
    elapsed = time.monotonic() - start

    assert elapsed < 1.0


def test_resolve_options_prefers_explicit_args_over_character():
    state = ListenerState()
    state.set_character({"voice": "rex", "speed": 1.3})
    state.set_language("pl")

    resolved = speech.resolve_options(state, "ara", "en", 0.9)

    assert resolved == ("ara", "en", 0.9)


def test_resolve_options_falls_back_to_character_and_daemon_language():
    state = ListenerState()
    state.set_character({"voice": "rex", "speed": 1.2})
    state.set_language("pl")

    resolved = speech.resolve_options(state, "", "", 1.0)

    assert resolved == ("rex", "pl", 1.2)


def test_resolve_options_uses_auto_language_when_nothing_configured(monkeypatch):
    monkeypatch.delenv(speech.DEFAULT_LANGUAGE_ENV_VAR, raising=False)
    state = ListenerState()

    resolved = speech.resolve_options(state, "", "", 1.0)

    assert resolved == ("carina", "auto", 1.0)


def test_resolve_options_uses_the_speaking_agents_character():
    state = ListenerState()
    state.set_character({"voice": "rex"}, "agent-a")
    state.set_character({"voice": "ara"}, "agent-b")

    resolved = speech.resolve_options(state, "", "", 1.0, agent="agent-b")

    assert resolved[0] == "ara"
