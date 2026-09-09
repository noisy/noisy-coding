import numpy as np
import pytest

from repair_audio import replace_intervals, validate_source


def test_repairs_preserve_samples_outside_markers_and_do_not_mutate_original():
    samples = np.full((1000, 1), 0.7, dtype=np.float32)
    samples[100:200] = 0.02
    original = samples.copy()
    plan = {'roomTone': {'startMs': 100, 'endMs': 200}, 'repairs': [{'startMs': 400, 'endMs': 700}]}

    repaired = replace_intervals(samples, 1000, plan)

    assert {
        'unchanged_source': np.array_equal(samples, original),
        'unchanged_prefix': np.array_equal(repaired[:400], samples[:400]),
        'unchanged_suffix': np.array_equal(repaired[700:], samples[700:]),
        'same_length': repaired.shape == samples.shape,
        'room_tone_inside': np.allclose(repaired[420:680], 0.02),
        'smooth_start': repaired[400, 0] == samples[400, 0],
        'smooth_end': repaired[699, 0] == samples[699, 0],
    } == dict.fromkeys(['unchanged_source', 'unchanged_prefix', 'unchanged_suffix', 'same_length', 'room_tone_inside', 'smooth_start', 'smooth_end'], True)


def test_marker_fingerprint_rejects_another_original(tmp_path):
    source = tmp_path / 'original.webm'
    source.write_bytes(b'original2')
    plan = {'kind': 'demo-audio-edits', 'version': 1, 'source': {'sha256': 'source1', 'size': 9}}

    with pytest.raises(ValueError, match='do not match'):
        validate_source(source, plan)


def test_room_tone_must_not_contain_a_marked_noise():
    plan = {'roomTone': {'startMs': 100, 'endMs': 300}, 'repairs': [{'startMs': 200, 'endMs': 400}]}

    with pytest.raises(ValueError, match='overlaps'):
        replace_intervals(np.zeros((1000, 1), dtype=np.float32), 1000, plan)
