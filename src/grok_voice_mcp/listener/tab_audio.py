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
        self._holder_ws = None  # the holder's socket, for outbound playback
        # Signalled by the tab's "played" ack — and by anything that makes
        # the ack impossible (holder disconnect), so the playback waiter
        # never blocks on a dead tab.
        self._play_ack = threading.Event()

    # --- lease election -----------------------------------------------------

    def claim(self, connection_id: int, ws=None) -> bool:
        """First live tab wins; a dead holder's lease has already expired."""
        with self._lock:
            if self._holder is not None and self._state.tab_audio_alive:
                return self._holder == connection_id
            self._holder = connection_id
            self._holder_ws = ws
            self._state.refresh_tab_audio()
            return True

    def release(self, connection_id: int) -> None:
        with self._lock:
            if self._holder == connection_id:
                self._holder = None
                self._holder_ws = None
                self._state.release_tab_audio()
                self._play_ack.set()  # a clip mid-flight can never be acked now

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

    # --- outbound playback ------------------------------------------------------

    def play_through_tab(self, audio: bytes, content_type: str) -> bool:
        """Send one clip to the lease-holding tab; block until it reports
        playback finished. Returns False when no live tab could play it —
        the caller falls back to the system speakers, speech is never lost.

        The wait is structural, not a guessed deadline: it ends on the
        tab's "played" ack, on the holder disconnecting (release() sets
        the event), or on lease death (a hung-but-connected tab stops
        heartbeating within TAB_AUDIO_LEASE_SECONDS). The 0.5 s wait slice
        only paces the lease re-check, it decides nothing by itself.
        """
        with self._lock:
            ws = self._holder_ws
        if ws is None or not self._state.tab_audio_alive:
            return False
        self._play_ack.clear()
        try:
            ws.send(json.dumps({"type": "play", "content_type": content_type}))
            ws.send(audio)
        except Exception:
            return False
        while not self._play_ack.wait(timeout=0.5):
            with self._lock:
                holder_changed = self._holder_ws is not ws
            if holder_changed or not self._state.tab_audio_alive:
                return False
        with self._lock:
            return self._holder_ws is ws

    def ack_played(self, connection_id: int, ws=None) -> None:
        """The tab reports its current clip finished (or was stopped)."""
        if self.claim(connection_id, ws):
            self._play_ack.set()

    def stop_tab_playback(self) -> None:
        """User hit ⏹ — the tab pauses its clip and acks 'played'."""
        with self._lock:
            ws = self._holder_ws
        if ws is None:
            return
        try:
            ws.send(json.dumps({"type": "stop"}))
        except Exception:
            pass

    # --- WS plumbing ----------------------------------------------------------

    def _handle(self, ws) -> None:  # pragma: no cover — thin I/O shell
        connection_id = id(ws)
        rechunker = FrameRechunker(self._frame_samples)
        try:
            for message in ws:
                if isinstance(message, bytes):
                    if not self.claim(connection_id, ws):
                        ws.send(json.dumps({"type": "rejected", "reason": "another tab holds the audio lease"}))
                        return
                    self.ingest(rechunker, message)
                    continue
                try:
                    kind = json.loads(message).get("type")
                except ValueError:
                    continue
                if kind == "hello":
                    if self.claim(connection_id, ws):
                        ws.send(json.dumps({"type": "granted"}))
                    else:
                        ws.send(json.dumps({"type": "rejected", "reason": "another tab holds the audio lease"}))
                        return
                elif kind == "hb" and self.claim(connection_id, ws):
                    self._state.refresh_tab_audio()
                elif kind == "played":
                    self.ack_played(connection_id, ws)
        finally:
            self.release(connection_id)

    def serve_forever(self, port: int) -> None:  # pragma: no cover — thread shell
        from websockets.sync.server import serve

        with serve(self._handle, "127.0.0.1", port) as server:
            server.serve_forever()


_bridge: TabAudioBridge | None = None


def bridge() -> TabAudioBridge | None:
    """The running bridge, for modules that can't be handed it (speech)."""
    return _bridge


def start_bridge(
    state: ListenerState,
    frames: "queue.Queue[np.ndarray]",
    frame_samples: int,
    http_port: int,
) -> TabAudioBridge:
    """Start the WS bridge on http_port+1 in a daemon thread."""
    global _bridge
    _bridge = TabAudioBridge(state, frames, frame_samples)
    threading.Thread(
        target=_bridge.serve_forever, args=(http_port + BRIDGE_PORT_OFFSET,), daemon=True
    ).start()
    return _bridge
