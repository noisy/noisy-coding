import queue

import numpy as np

from noisy_coding.listener.state import ListenerState
from noisy_coding.listener.tab_audio import FrameRechunker, TabAudioBridge

FRAME_SAMPLES = 480  # 30 ms @ 16 kHz


def _pcm(samples: int, value: int = 1000) -> bytes:
    return (np.ones(samples, dtype=np.int16) * value).tobytes()


def _bridge(state: ListenerState | None = None):
    state = state or ListenerState()
    frames: "queue.Queue[np.ndarray]" = queue.Queue()
    return TabAudioBridge(state, frames, FRAME_SAMPLES), state, frames


def test_rechunker_slices_arbitrary_chunks_into_vad_frames():
    rechunker = FrameRechunker(FRAME_SAMPLES)

    assert rechunker.push(_pcm(100)) == []  # not enough yet
    frames = rechunker.push(_pcm(1000))  # 1100 total → 2 frames + 140 kept

    assert [len(f) for f in frames] == [FRAME_SAMPLES, FRAME_SAMPLES]
    assert len(rechunker.push(_pcm(FRAME_SAMPLES - 140))) == 1  # remainder completes


def test_rechunker_survives_an_odd_trailing_byte():
    rechunker = FrameRechunker(FRAME_SAMPLES)

    frames = rechunker.push(_pcm(FRAME_SAMPLES) + b"\x01")

    assert len(frames) == 1  # odd byte dropped, alignment kept


def test_first_tab_wins_the_lease_and_a_second_is_rejected():
    bridge, state, _ = _bridge()

    assert bridge.claim(connection_id=1) is True
    assert bridge.claim(connection_id=2) is False
    assert bridge.claim(connection_id=1) is True  # holder re-claims freely


def test_released_or_expired_lease_lets_the_next_tab_in():
    bridge, state, _ = _bridge()
    assert bridge.claim(connection_id=1)

    bridge.release(connection_id=1)
    assert bridge.claim(connection_id=2) is True

    # A dead holder (no heartbeat → lease expired) also loses the election.
    state.release_tab_audio()
    assert bridge.claim(connection_id=3) is True


def test_ingest_feeds_the_frames_queue_only_in_browser_mode():
    bridge, state, frames = _bridge()
    bridge.claim(connection_id=1)
    rechunker = FrameRechunker(FRAME_SAMPLES)

    assert bridge.ingest(rechunker, _pcm(FRAME_SAMPLES)) == 0  # native mic selected
    assert frames.empty()

    state.set_input_device("browser")
    assert bridge.ingest(rechunker, _pcm(FRAME_SAMPLES)) == 1
    assert frames.get_nowait().shape == (FRAME_SAMPLES,)


def test_ingest_renews_the_lease():
    bridge, state, _ = _bridge()
    bridge.claim(connection_id=1)
    state.release_tab_audio()
    assert not state.tab_audio_alive

    bridge.ingest(FrameRechunker(FRAME_SAMPLES), _pcm(10))

    assert state.tab_audio_alive


class FakeWs:
    def __init__(self):
        self.sent: list = []

    def send(self, data):
        self.sent.append(data)


def test_play_through_tab_without_a_tab_reports_false():
    bridge, _, _ = _bridge()

    assert bridge.play_through_tab(b"mp3", "audio/mpeg") is False


def test_play_through_tab_sends_clip_and_waits_for_the_ack():
    import threading

    bridge, _, _ = _bridge()
    ws = FakeWs()
    assert bridge.claim(1, ws)

    result: list = []
    player = threading.Thread(
        target=lambda: result.append(bridge.play_through_tab(b"mp3-bytes", "audio/mpeg"))
    )
    player.start()
    bridge.ack_played(1, ws)
    player.join(timeout=3)

    assert result == [True]
    assert ws.sent[0] == '{"type": "play", "content_type": "audio/mpeg"}'
    assert ws.sent[1] == b"mp3-bytes"


def test_play_through_tab_aborts_when_the_tab_disconnects_mid_clip():
    import threading

    bridge, _, _ = _bridge()
    ws = FakeWs()
    assert bridge.claim(1, ws)

    result: list = []
    player = threading.Thread(
        target=lambda: result.append(bridge.play_through_tab(b"mp3", "audio/mpeg"))
    )
    player.start()
    bridge.release(1)  # tab closed: the ack can never come
    player.join(timeout=3)

    assert result == [False]


def test_stop_tab_playback_tells_the_tab_to_stop_mid_clip():
    import threading
    import time

    bridge, _, _ = _bridge()
    ws = FakeWs()
    bridge.claim(1, ws)

    player = threading.Thread(
        target=lambda: bridge.play_through_tab(b"mp3-bytes", "audio/mpeg")
    )
    player.start()
    deadline = time.monotonic() + 2
    while len(ws.sent) < 2 and time.monotonic() < deadline:
        time.sleep(0.01)  # clip is in flight once play + audio went out
    bridge.stop_tab_playback()
    bridge.ack_played(1, ws)
    player.join(timeout=3)

    assert '{"type": "stop"}' in ws.sent


def test_stop_tab_playback_is_a_noop_while_nothing_plays():
    bridge, _, _ = _bridge()
    ws = FakeWs()
    bridge.claim(1, ws)

    bridge.stop_tab_playback()

    # No stray stop → no stray "played" ack poisoning the NEXT clip's wait
    # (the tab acks every stop, even with nothing playing).
    assert ws.sent == []


def test_ingest_marks_the_tab_mic_as_live():
    bridge, state, _ = _bridge()
    state.set_input_device("browser")
    state.refresh_tab_audio()

    bridge.ingest(FrameRechunker(FRAME_SAMPLES), _pcm(FRAME_SAMPLES))

    assert state.tab_mic_live is True  # PCM flowing = capturing, no guesswork
