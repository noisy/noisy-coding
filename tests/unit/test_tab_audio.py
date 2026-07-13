import queue

import numpy as np

from grok_voice_mcp.listener.state import ListenerState
from grok_voice_mcp.listener.tab_audio import FrameRechunker, TabAudioBridge

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
