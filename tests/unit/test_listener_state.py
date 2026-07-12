import threading
import time

from grok_voice_mcp.listener import state as state_module
from grok_voice_mcp.listener.state import ListenerState


def _finishes_within(fn, seconds: float) -> bool:
    done = threading.Event()

    def run() -> None:
        fn()
        done.set()

    threading.Thread(target=run, daemon=True).start()
    return done.wait(seconds)


def test_drain_returns_transcripts_in_order_and_empties_queue():
    state = ListenerState()
    state.add_transcript("first")
    state.add_transcript("second")

    drained = state.drain()

    assert [t.text for t in drained] == ["first", "second"]
    assert state.drain() == []


def test_events_since_returns_only_newer_events_including_drain_delivery():
    state = ListenerState()
    state.add_event("recording")
    state.add_transcript("hello")
    seen = state.events_since(0)
    state.drain()

    fresh = state.events_since(seen[-1]["seq"])

    assert [e["kind"] for e in seen] == ["recording", "transcript"]
    assert [(e["kind"], e["detail"]) for e in fresh] == [("delivered", "hello")]


def test_last_transcript_at_tracks_newest_transcript():
    state = ListenerState()
    assert state.last_transcript_at == 0.0

    state.add_transcript("hello")

    assert state.last_transcript_at > 0.0


def test_wait_for_user_silence_returns_immediately_when_user_is_quiet():
    state = ListenerState()

    assert _finishes_within(state.wait_for_user_silence, seconds=1.0)


def test_wait_for_user_silence_blocks_until_recording_ends():
    state = ListenerState()
    state.set_recording(True)
    done = threading.Event()
    threading.Thread(
        target=lambda: (state.wait_for_user_silence(), done.set()), daemon=True
    ).start()

    assert not done.wait(0.15)
    state.set_recording(False)
    assert done.wait(1.0)


def test_wait_for_user_silence_treats_muted_mic_as_silence():
    state = ListenerState()
    state.set_recording(True)
    state.set_user_muted(True)

    assert _finishes_within(state.wait_for_user_silence, seconds=1.0)


def test_wait_for_user_silence_wakes_when_mic_gets_muted_mid_wait():
    state = ListenerState()
    state.set_recording(True)
    done = threading.Event()
    threading.Thread(
        target=lambda: (state.wait_for_user_silence(), done.set()), daemon=True
    ).start()

    assert not done.wait(0.15)
    state.set_user_muted(True)
    assert done.wait(1.0)


def test_wait_for_user_silence_grace_lets_the_user_add_a_thought():
    state = ListenerState()
    state.set_recording(True)
    state.set_recording(False)
    done = threading.Event()
    threading.Thread(
        target=lambda: (state.wait_for_user_silence(grace_s=0.3), done.set()),
        daemon=True,
    ).start()

    assert not done.wait(0.1)  # utterance just ended — still inside the grace
    state.set_recording(True)  # the user adds a follow-up thought
    assert not done.wait(0.35)  # held again, even though grace has elapsed
    state.set_recording(False)
    assert done.wait(1.0)


def test_user_utterance_commits_when_the_transcript_is_ready():
    state = ListenerState()
    utterance_id = state.create_utterance("user", "recording…")
    assert state.utterances()[0]["committed_at"] == 0.0  # still composing

    state.add_transcript("finished thought", utterance_id)

    assert state.utterances()[0]["committed_at"] > 0.0


def test_claude_utterance_commits_on_creation():
    state = ListenerState()
    state.create_utterance("claude", "queued")

    assert state.utterances()[0]["committed_at"] > 0.0


def test_cancel_transcript_recalls_a_queued_message():
    state = ListenerState()
    utterance_id = state.create_utterance("user", "recording…")
    state.add_transcript("take this back", utterance_id)

    assert state.cancel_transcript(utterance_id) is True
    assert state.drain() == []
    statuses = {u["id"]: u["status"] for u in state.utterances()}
    assert statuses[utterance_id] == "cancelled by you"


def test_cancel_transcript_is_too_late_after_drain():
    state = ListenerState()
    utterance_id = state.create_utterance("user", "recording…")
    state.add_transcript("already delivered", utterance_id)
    state.drain()

    assert state.cancel_transcript(utterance_id) is False


def test_ptt_hold_is_a_lease_renewed_and_released():
    state = ListenerState()
    assert state.ptt_held is False

    state.refresh_ptt_hold()
    assert state.ptt_held is True

    state.release_ptt()
    assert state.ptt_held is False


def test_ptt_lease_expires_without_renewal(monkeypatch):
    monkeypatch.setattr(state_module, "PTT_LEASE_SECONDS", 0.05)
    state = ListenerState()
    state.refresh_ptt_hold()

    time.sleep(0.1)

    assert state.ptt_held is False


def test_detection_mode_accepts_only_known_values():
    state = ListenerState()
    assert state.set_detection_mode("ptt") == "ptt"
    assert state.set_detection_mode("nonsense") == "ptt"
    assert state.set_detection_mode("auto") == "auto"


def test_wait_for_user_silence_skips_grace_when_user_finished_long_ago():
    state = ListenerState()
    state.set_recording(True)
    state.set_recording(False)
    time.sleep(0.35)

    assert _finishes_within(
        lambda: state.wait_for_user_silence(grace_s=0.3), seconds=0.2
    )
