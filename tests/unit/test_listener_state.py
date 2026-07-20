import threading
import time

from noisy_coding.listener import state as state_module
from noisy_coding.listener.state import ListenerState


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


def test_input_device_defaults_to_system_and_remembers_the_pick():
    state = ListenerState()
    assert state.input_device == ""

    assert state.set_input_device("AirPods Pro") == "AirPods Pro"
    assert state.input_device == "AirPods Pro"

    assert state.set_input_device("") == ""  # back to system default


def test_system_rows_commit_on_creation():
    state = ListenerState()
    state.create_utterance("system", "", text="MIC → Jabra Link 380")

    row = state.utterances()[0]
    assert row["role"] == "system"
    assert row["committed_at"] > 0.0  # joins the timeline immediately


def test_usage_accumulates_audio_seconds_and_characters():
    state = ListenerState()
    assert state.usage == {"stt_seconds": 0.0, "tts_chars": 0}

    state.add_usage("stt_seconds", 7.5)
    state.add_usage("stt_seconds", 2.5)
    state.add_usage("tts_chars", 120)

    assert state.usage == {"stt_seconds": 10.0, "tts_chars": 120}


def test_latency_tracking_keeps_the_last_measurement_per_kind():
    state = ListenerState()
    assert state.latency_ms == {"stt": None, "tts": None}

    state.set_latency("stt", 412.7)
    state.set_latency("tts", 380.2)
    state.set_latency("stt", 350.0)

    assert state.latency_ms == {"stt": 350, "tts": 380}


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


def test_new_agent_never_steals_the_active_slot():
    state = ListenerState()
    state.register_agent("first")
    state.register_agent("second")

    assert state.active_agent == "first"


def test_stale_active_agent_keeps_the_mic_and_stays_visible(monkeypatch):
    monkeypatch.setattr(state_module, "AGENT_OFFLINE_AFTER_SECONDS", 0.05)
    state = ListenerState()
    state.register_agent("mine")
    state.register_agent("other")
    time.sleep(0.1)
    state.drain("other")  # only "other" keeps polling

    # Switching is the user's conscious act: the quiet active agent stays
    # active AND visible; its speech queues until it returns.
    assert state.active_agent == "mine"
    assert "mine" in state.agents
    assert state.drain("other") == []  # not their turn — speech is not rerouted


def test_silent_agents_go_offline_but_are_never_deleted(monkeypatch):
    monkeypatch.setattr(state_module, "AGENT_OFFLINE_AFTER_SECONDS", 0.05)
    state = ListenerState()
    state.register_agent("mine")
    state.register_agent("other")
    time.sleep(0.1)
    state.drain("mine")  # only the active one keeps polling

    meta = state.agents_meta
    assert "other" in state.agents  # known agents survive silence
    assert meta["other"]["online"] is False
    assert meta["other"]["offline_since"] is not None
    assert meta["mine"]["online"] is True


def test_agent_reactivation_restamps_its_arrival_into_the_active_group(monkeypatch):
    monkeypatch.setattr(state_module, "AGENT_OFFLINE_AFTER_SECONDS", 0.05)
    state = ListenerState()
    state.register_agent("early")
    state.register_agent("late")
    first_stamp = state.agents_meta["early"]["activated_at"]
    time.sleep(0.1)  # both go offline

    state.drain("early")  # "early" comes back → rejoins the actives LAST

    meta = state.agents_meta
    assert meta["early"]["online"] is True
    assert meta["early"]["activated_at"] > first_stamp
    assert meta["early"]["activated_at"] > meta["late"]["activated_at"]


def test_heartbeat_within_tolerance_keeps_the_activation_stamp():
    state = ListenerState()
    state.register_agent("steady")
    stamp = state.agents_meta["steady"]["activated_at"]

    state.drain("steady")  # normal heartbeat, no offline gap

    assert state.agents_meta["steady"]["activated_at"] == stamp


def test_reorder_pins_manual_positions_for_known_agents_only():
    state = ListenerState()
    state.register_agent("a")
    state.register_agent("b")

    state.reorder_agents(["b", "ghost", "a"])

    meta = state.agents_meta
    assert meta["b"]["manual_pos"] == 0
    assert meta["a"]["manual_pos"] == 2
    assert "ghost" not in state.agents


def test_dismiss_removes_only_offline_non_active_agents(monkeypatch):
    monkeypatch.setattr(state_module, "AGENT_OFFLINE_AFTER_SECONDS", 0.05)
    state = ListenerState()
    state.register_agent("mine")
    state.register_agent("other")

    assert state.dismiss_agent("other") is False  # still online
    time.sleep(0.1)
    assert state.dismiss_agent("mine") is False  # active, even when silent
    assert state.dismiss_agent("ghost") is False  # unknown

    assert state.dismiss_agent("other") is True
    assert "other" not in state.agents
    assert "mine" in state.agents


def test_restore_active_agent_survives_the_first_to_register_race():
    state = ListenerState()
    state.restore_active_agent("mine")  # daemon restart restored the pick

    state.register_agent("interloper")  # polls first after the restart

    assert state.active_agent == "mine"
    assert "mine" in state.agents  # visible as a tab even before it returns


def test_mic_sensitivity_defaults_to_mid_and_clamps():
    state = ListenerState()

    assert state.mic_sensitivity == 50
    assert state.set_mic_sensitivity(250) == 100
    assert state.set_mic_sensitivity(-5) == 0
    assert state.set_mic_sensitivity(75) == 75


def test_tab_mic_requires_both_the_flag_and_a_live_lease():
    state = ListenerState()
    assert state.tab_mic_live is False

    state.set_tab_mic(True)
    assert state.tab_mic_live is False  # a dead lease can't have a live mic

    state.refresh_tab_audio()
    assert state.tab_mic_live is True

    state.release_tab_audio()
    assert state.tab_mic_live is False  # release clears the mic flag too
