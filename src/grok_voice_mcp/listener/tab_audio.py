"""Browser-tab audio bridge: the dashboard tab as a selectable audio device.

A WebSocket server one port above the HTTP API. A tab claims the AUDIO
LEASE by connecting; every message it sends (audio or heartbeat) renews
the lease, so a crashed page or dropped connection frees the device by
itself — structural safety, no timer guessing at human behavior (see
PTT_LEASE_SECONDS for the same pattern).

Wire protocol, deliberately tiny:
- text JSON in:  {"type": "hello"}  → reply {"type": "granted"} or
                 {"type": "rejected", "reason": …} (another tab holds it)
                 {"type": "hb"}     → lease heartbeat while silent
- binary in:     raw int16 mono 16 kHz PCM, any chunk size — re-chunked
                 here to the VAD's frame size and pushed into the SAME
                 frames queue the native microphone feeds. That is the
                 whole trick: downstream (RMS, VAD, PTT, STT) cannot tell
                 the difference.
"""

from __future__ import annotations

import json
import queue
import threading

import numpy as np

from .state import ListenerState

BRIDGE_PORT_OFFSET = 1  # WS lives one port above the HTTP API


class FrameRechunker:
    """Slice an arbitrary PCM byte stream into fixed VAD-sized frames."""

    def __init__(self, frame_samples: int) -> None:
        self._frame_samples = frame_samples
        self._pending = np.empty(0, dtype=np.int16)

    def push(self, chunk: bytes) -> list[np.ndarray]:
        # An odd trailing byte would desync every later sample; int16 PCM
        # can never legitimately produce one, so drop it loudly-in-spirit.
        usable = len(chunk) - (len(chunk) % 2)
        samples = np.frombuffer(chunk[:usable], dtype=np.int16)
        self._pending = np.concatenate([self._pending, samples])
        frames: list[np.ndarray] = []
        while len(self._pending) >= self._frame_samples:
            frames.append(self._pending[: self._frame_samples].copy())
            self._pending = self._pending[self._frame_samples :]
        return frames


class TabAudioBridge:
    """Owns the lease election and feeds tab audio into the frames queue."""

    def __init__(
        self,
        state: ListenerState,
        frames: "queue.Queue[np.ndarray]",
        frame_samples: int,
    ) -> None:
        self._state = state
        self._frames = frames
        self._frame_samples = frame_samples
        self._lock = threading.Lock()
        self._holder: int | None = None  # id() of the connection holding the lease

    # --- lease election -----------------------------------------------------

    def claim(self, connection_id: int) -> bool:
        """First live tab wins; a dead holder's lease has already expired."""
        with self._lock:
            if self._holder is not None and self._state.tab_audio_alive:
                return self._holder == connection_id
            self._holder = connection_id
            self._state.refresh_tab_audio()
            return True

    def release(self, connection_id: int) -> None:
        with self._lock:
            if self._holder == connection_id:
                self._holder = None
                self._state.release_tab_audio()

    # --- ingest ---------------------------------------------------------------

    def ingest(self, rechunker: FrameRechunker, message: bytes) -> int:
        """One binary WS message → zero or more VAD frames. Returns count."""
        self._state.refresh_tab_audio()
        # Frames flow only while the tab IS the selected microphone —
        # otherwise the lease stays warm but audio is discarded, so
        # selecting "THIS BROWSER TAB" later starts clean, not with a
        # backlog of stale room noise.
        if self._state.input_device != "browser":
            rechunker.push(message)  # keep sample alignment across the gap
            return 0
        frames = rechunker.push(message)
        for frame in frames:
            self._frames.put(frame)
        return len(frames)

    # --- WS plumbing ----------------------------------------------------------

    def _handle(self, ws) -> None:  # pragma: no cover — thin I/O shell
        connection_id = id(ws)
        rechunker = FrameRechunker(self._frame_samples)
        try:
            for message in ws:
                if isinstance(message, bytes):
                    if not self.claim(connection_id):
                        ws.send(json.dumps({"type": "rejected", "reason": "another tab holds the audio lease"}))
                        return
                    self.ingest(rechunker, message)
                    continue
                try:
                    kind = json.loads(message).get("type")
                except ValueError:
                    continue
                if kind == "hello":
                    if self.claim(connection_id):
                        ws.send(json.dumps({"type": "granted"}))
                    else:
                        ws.send(json.dumps({"type": "rejected", "reason": "another tab holds the audio lease"}))
                        return
                elif kind == "hb" and self.claim(connection_id):
                    self._state.refresh_tab_audio()
        finally:
            self.release(connection_id)

    def serve_forever(self, port: int) -> None:  # pragma: no cover — thread shell
        from websockets.sync.server import serve

        with serve(self._handle, "127.0.0.1", port) as server:
            server.serve_forever()


def start_bridge(
    state: ListenerState,
    frames: "queue.Queue[np.ndarray]",
    frame_samples: int,
    http_port: int,
) -> TabAudioBridge:
    """Start the WS bridge on http_port+1 in a daemon thread."""
    bridge = TabAudioBridge(state, frames, frame_samples)
    threading.Thread(
        target=bridge.serve_forever, args=(http_port + BRIDGE_PORT_OFFSET,), daemon=True
    ).start()
    return bridge
