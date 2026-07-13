import numpy as np
import pytest

from grok_voice_mcp.listener.vad import UtteranceSegmenter, VadConfig

CONFIG = VadConfig()


@pytest.fixture
def make_frames():
    def _make(loud: bool, count: int) -> list[np.ndarray]:
        amplitude = 5000 if loud else 50
        rng = np.random.default_rng(seed=42)
        return [
            (rng.uniform(-1, 1, CONFIG.frame_samples) * amplitude).astype(np.int16)
            for _ in range(count)
        ]

    return _make


def _feed_all(segmenter, frames):
    return [u for u in (segmenter.feed(f) for f in frames) if u is not None]


def test_utterance_emitted_after_speech_followed_by_silence(make_frames):
    segmenter = UtteranceSegmenter(CONFIG)
    speech_frames = 40  # 1.2s of speech
    silence_frames = CONFIG.end_silence_ms // CONFIG.frame_ms + 1

    utterances = _feed_all(
        segmenter,
        make_frames(False, 20) + make_frames(True, speech_frames) + make_frames(False, silence_frames),
    )

    assert len(utterances) == 1
    assert len(utterances[0]) >= speech_frames * CONFIG.frame_samples


def test_short_blip_is_dropped(make_frames):
    segmenter = UtteranceSegmenter(CONFIG)
    blip_frames = 4  # 120ms — below min_utterance_ms
    silence_frames = CONFIG.end_silence_ms // CONFIG.frame_ms + 1

    utterances = _feed_all(
        segmenter,
        make_frames(False, 20) + make_frames(True, blip_frames) + make_frames(False, silence_frames),
    )

    assert utterances == []


def test_silence_alone_never_emits(make_frames):
    segmenter = UtteranceSegmenter(CONFIG)

    utterances = _feed_all(segmenter, make_frames(False, 200))

    assert utterances == []


def test_overlong_speech_is_cut_at_max_utterance_length(make_frames):
    config = VadConfig(max_utterance_ms=3_000)
    segmenter = UtteranceSegmenter(config)
    frames_for_5s = 5_000 // config.frame_ms

    utterances = _feed_all(segmenter, make_frames(False, 20) + make_frames(True, frames_for_5s))

    assert len(utterances) >= 1
    assert len(utterances[0]) <= (config.max_utterance_ms // config.frame_ms + 1) * config.frame_samples


def test_flush_closes_the_open_utterance_immediately(make_frames):
    # Mic mute mid-sentence: no more frames will EVER arrive, so the
    # segmenter must hand over what it holds without waiting for silence.
    segmenter = UtteranceSegmenter(CONFIG)
    _feed_all(segmenter, make_frames(False, 20) + make_frames(True, 40))
    assert segmenter.is_recording

    utterance = segmenter.flush()

    assert utterance is not None
    assert len(utterance) >= 40 * CONFIG.frame_samples
    assert not segmenter.is_recording


def test_flush_is_a_no_op_when_idle(make_frames):
    segmenter = UtteranceSegmenter(CONFIG)
    _feed_all(segmenter, make_frames(False, 10))

    assert segmenter.flush() is None
    assert not segmenter.is_recording
