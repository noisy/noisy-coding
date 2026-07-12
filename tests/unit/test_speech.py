import asyncio
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
    monkeypatch.setattr(speech, "ECHO_TAIL_SECONDS", 0)

    futures = [speech.submit(state, f"utterance {i}") for i in range(2)]
    for future in futures:
        future.result(timeout=5)

    first_end = min(end for _, end in intervals)
    last_start = max(start for start, _ in intervals)
    assert last_start >= first_end


def test_utterance_cards_appear_at_enqueue_in_creation_order(monkeypatch):
    state = ListenerState()

    async def slow_play(*_args):
        await asyncio.sleep(0.2)

    monkeypatch.setattr(speech, "_synthesize_and_play", slow_play)
    monkeypatch.setattr(speech, "ECHO_TAIL_SECONDS", 0)

    futures = [speech.submit(state, "first"), speech.submit(state, "second")]
    texts = [u["text"] for u in state.utterances() if u["role"] == "claude"]

    assert texts == ["„first”", "„second”"]  # both visible before either played
    for future in futures:
        future.result(timeout=5)


def test_render_waits_for_the_user_to_finish_before_playing(monkeypatch):
    state = ListenerState()
    state.set_recording(True)
    play_started_at = []

    async def fake_synthesize_and_play(*_args):
        play_started_at.append(time.monotonic())

    monkeypatch.setattr(speech, "_synthesize_and_play", fake_synthesize_and_play)
    monkeypatch.setattr(speech, "ECHO_TAIL_SECONDS", 0)

    future = speech.submit(state, "hold me")
    time.sleep(0.15)
    assert not play_started_at
    user_finished_at = time.monotonic()
    state.set_recording(False)
    future.result(timeout=5)

    assert play_started_at[0] >= user_finished_at


def test_resolve_options_reads_voice_and_speed_from_character_and_daemon_language():
    state = ListenerState()
    state.set_character({"voice": "rex", "speed": 1.2})
    state.set_language("pl")

    resolved = speech.resolve_options(state)

    assert resolved == ("rex", "pl", 1.2)


def test_resolve_options_uses_auto_language_when_nothing_configured(monkeypatch):
    monkeypatch.delenv(speech.DEFAULT_LANGUAGE_ENV_VAR, raising=False)
    state = ListenerState()

    resolved = speech.resolve_options(state)

    assert resolved == ("carina", "auto", 1.0)


def test_resolve_options_uses_the_speaking_agents_character():
    state = ListenerState()
    state.set_character({"voice": "rex"}, "agent-a")
    state.set_character({"voice": "ara"}, "agent-b")

    resolved = speech.resolve_options(state, agent="agent-b")

    assert resolved[0] == "ara"
