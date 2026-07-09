"""Energy-based voice activity detection over a stream of audio frames.

Pure logic, no I/O: feed fixed-size int16 frames, get complete utterances back.
The noise floor adapts with an exponential moving average while nobody speaks,
so the speech threshold follows the room's ambient level.
"""

from collections import deque
from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True)
class VadConfig:
    sample_rate: int = 16_000
    frame_ms: int = 30
    noise_floor_alpha: float = 0.05
    speech_multiplier: float = 3.0
    min_speech_rms: float = 300.0
    start_frames: int = 2
    end_silence_ms: int = 800
    pre_roll_ms: int = 700
    min_utterance_ms: int = 400
    max_utterance_ms: int = 180_000

    @property
    def frame_samples(self) -> int:
        return self.sample_rate * self.frame_ms // 1000


def _rms(frame: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(frame.astype(np.float64)))))


@dataclass
class UtteranceSegmenter:
    config: VadConfig = field(default_factory=VadConfig)

    def __post_init__(self) -> None:
        pre_roll_frames = max(1, self.config.pre_roll_ms // self.config.frame_ms)
        self._pre_roll: deque[np.ndarray] = deque(maxlen=pre_roll_frames)
        self._noise_floor = self.config.min_speech_rms
        self._speech_run = 0
        self._silence_run = 0
        self._recording: list[np.ndarray] = []
        self._pre_roll_frames_included = 0
        # Live-adjustable from the dashboard; None = use the config default.
        self.end_silence_ms_override: int | None = None
        # Set by an external end-of-turn signal (smart_turn) to close now.
        self._close_requested = False

    def request_close(self) -> None:
        """Force the utterance in progress to close on the next frame."""
        self._close_requested = True

    @property
    def _end_silence_ms(self) -> int:
        return self.end_silence_ms_override or self.config.end_silence_ms

    @property
    def is_recording(self) -> bool:
        return bool(self._recording)

    @property
    def recording_frames(self) -> list[np.ndarray]:
        """Frames captured so far in the utterance in progress (incl. pre-roll)."""
        return list(self._recording)

    def feed(self, frame: np.ndarray) -> np.ndarray | None:
        """Consume one frame; return a full utterance when one just ended."""
        loud = self._is_speech(_rms(frame))
        if self.is_recording:
            return self._feed_recording(frame, loud)
        return self._feed_idle(frame, loud)

    def _is_speech(self, rms: float) -> bool:
        threshold = max(
            self.config.min_speech_rms,
            self._noise_floor * self.config.speech_multiplier,
        )
        return rms >= threshold

    def _feed_idle(self, frame: np.ndarray, loud: bool) -> None:
        self._pre_roll.append(frame)
        if loud:
            self._speech_run += 1
            if self._speech_run >= self.config.start_frames:
                self._recording = list(self._pre_roll)
                self._pre_roll_frames_included = len(self._pre_roll) - self._speech_run
                self._silence_run = 0
        else:
            self._speech_run = 0
            alpha = self.config.noise_floor_alpha
            self._noise_floor = (1 - alpha) * self._noise_floor + alpha * _rms(frame)
        return None

    def _feed_recording(self, frame: np.ndarray, loud: bool) -> np.ndarray | None:
        self._recording.append(frame)
        self._silence_run = 0 if loud else self._silence_run + 1

        ended_by_silence = (
            self._silence_run * self.config.frame_ms >= self._end_silence_ms
        )
        too_long = (
            len(self._recording) * self.config.frame_ms >= self.config.max_utterance_ms
        )
        if not (ended_by_silence or too_long or self._close_requested):
            return None
        self._close_requested = False
        return self._finish_utterance()

    def _finish_utterance(self) -> np.ndarray | None:
        utterance = np.concatenate(self._recording)
        self._recording = []
        self._speech_run = 0
        self._pre_roll.clear()

        speech_frames = (
            len(utterance) // self.config.frame_samples
            - self._pre_roll_frames_included
            - self._silence_run
        )
        speech_ms = speech_frames * self.config.frame_ms
        self._silence_run = 0
        self._pre_roll_frames_included = 0
        if speech_ms < self.config.min_utterance_ms:
            return None
        return utterance
