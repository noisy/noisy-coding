"""Voice PE bridge: the Home Assistant Voice PE speaker as an audio device.

The speaker talks the native ESPHome API — no Home Assistant anywhere. This
module is the tab_audio twin for hardware: one persistent connection (with
the library's own reconnect logic), and the speaker becomes

- a selectable MICROPHONE: after the on-device wake word ("Hey Jarvis") the
  device streams 16 kHz int16 PCM over the API; frames are re-chunked and
  pushed into the SAME frames queue the native mic and the browser tab feed,
  so downstream (VAD/STT/PTT) cannot tell the difference;
- a selectable SPEAKER: rendered TTS clips are served over a one-shot LAN
  HTTP URL and played as announcements; the device reports back when the
  announcement finished, so playback blocks exactly as long as audio plays
  (structural, no duration guessing).

Configured by a single value: the device host (settings key `voice_pe_host`
or NOISY_CODING_VOICE_PE_HOST). No host = the bridge never starts and the
rest of the daemon behaves exactly as before.
"""

from __future__ import annotations

import asyncio
import functools
import http.server
import os
import queue
import socket
import threading
import uuid

import numpy as np

from .state import ListenerState
from .tab_audio import FrameRechunker

HOST_ENV_VAR = "NOISY_CODING_VOICE_PE_HOST"
ESPHOME_PORT = 6053
# Announcement completion is device-reported; this ceiling only guards
# against a device that dies mid-announcement without disconnecting.
ANNOUNCE_TIMEOUT_SECONDS = 120.0
WAKE_WORD_CONFIG_TIMEOUT_SECONDS = 5.0
PREFERRED_WAKE_WORD = "hey_jarvis"

CONTENT_TYPE_SUFFIX = {"audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/wav": ".wav"}


def _log(message: str) -> None:
    print(message, flush=True)


class _OneShotAudioServer:
    """Serve rendered clips to the speaker over plain LAN HTTP.

    Bound to all interfaces (the device must reach us); serves ONLY tokens
    handed out by publish() — nothing on disk is exposed. Entries are
    removed on unpublish, so a URL outlives its playback by nothing.
    """

    def __init__(self) -> None:
        self._clips: dict[str, tuple[bytes, str]] = {}
        self._lock = threading.Lock()
        clips, lock = self._clips, self._lock

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                token = self.path.lstrip("/")
                with lock:
                    entry = clips.get(token)
                if entry is None:
                    self.send_error(404)
                    return
                audio, content_type = entry
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(audio)))
                self.end_headers()
                self.wfile.write(audio)

            def log_message(self, *args: object) -> None:
                pass

        self._server = http.server.ThreadingHTTPServer(("0.0.0.0", 0), Handler)
        threading.Thread(
            target=self._server.serve_forever, name="voice-pe-audio", daemon=True
        ).start()

    @property
    def port(self) -> int:
        return self._server.server_address[1]

    def publish(self, audio: bytes, content_type: str) -> str:
        token = uuid.uuid4().hex + CONTENT_TYPE_SUFFIX.get(content_type, ".mp3")
        with self._lock:
            self._clips[token] = (audio, content_type)
        return token

    def unpublish(self, token: str) -> None:
        with self._lock:
            self._clips.pop(token, None)


class VoicePEBridge:
    """Owns the ESPHome connection; safe to call from any thread."""

    def __init__(
        self,
        state: ListenerState,
        frames: "queue.Queue[np.ndarray]",
        frame_samples: int,
        host: str,
    ) -> None:
        self._state = state
        self._frames = frames
        self._frame_samples = frame_samples
        self._host = host
        self._loop = asyncio.new_event_loop()
        self._client = None
        self._media_player_key: int | None = None
        self._connected = threading.Event()
        self._session_active = False
        self._rechunker = FrameRechunker(frame_samples)
        self._audio_server = _OneShotAudioServer()
        threading.Thread(target=self._run_loop, name="voice-pe", daemon=True).start()

    # --- public, thread-safe --------------------------------------------------

    @property
    def connected(self) -> bool:
        return self._connected.is_set()

    def play_through_speaker(
        self, audio: bytes, content_type: str, follow_up: bool = False
    ) -> bool:
        """Play one clip on the speaker; block until the device reports the
        announcement finished. False = not connected / failed — the caller
        falls back to the system speakers, speech is never lost.

        follow_up=True asks the device to open a listen session right after
        the clip (no wake word, no button) — a spoken QUESTION hands the
        user their turn, a fire-and-forget announce does not."""
        if not self.connected:
            return False
        token = self._audio_server.publish(audio, content_type)
        url = f"http://{self._lan_ip()}:{self._audio_server.port}/{token}"
        try:
            future = asyncio.run_coroutine_threadsafe(
                self._announce(url, follow_up), self._loop
            )
            return future.result(timeout=ANNOUNCE_TIMEOUT_SECONDS + 10)
        except Exception as error:
            _log(f"[voice-pe] announcement failed: {error}")
            self._state.add_event("voice_pe_error", f"announce: {str(error)[:160]}")
            return False
        finally:
            self._audio_server.unpublish(token)

    def stop_playback(self) -> None:
        """User interrupt: cut whatever the speaker is playing, right now."""
        if self.connected:
            asyncio.run_coroutine_threadsafe(self._stop_media(), self._loop)

    def notify_utterance_closed(self) -> None:
        """The daemon's VAD closed the utterance — end the device's voice
        session so it stops streaming and returns to wake-word idle."""
        if self.connected and self._session_active:
            asyncio.run_coroutine_threadsafe(self._end_session(), self._loop)

    # --- event loop side --------------------------------------------------------

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._main())

    async def _main(self) -> None:
        from aioesphomeapi import APIClient, ReconnectLogic

        self._client = APIClient(self._host, ESPHOME_PORT, password="")
        reconnect = ReconnectLogic(
            client=self._client,
            on_connect=self._on_connect,
            on_disconnect=self._on_disconnect,
            name=self._host,
        )
        await reconnect.start()
        await asyncio.Event().wait()  # the bridge lives as long as the daemon

    async def _on_connect(self) -> None:
        info = await self._client.device_info()
        entities, _services = await self._client.list_entities_services()
        self._media_player_key = next(
            (e.key for e in entities if type(e).__name__ == "MediaPlayerInfo"), None
        )
        self._client.subscribe_voice_assistant(
            handle_start=self._handle_va_start,
            handle_stop=self._handle_va_stop,
            handle_audio=self._handle_va_audio,
        )
        await self._prefer_wake_word()
        self._connected.set()
        _log(f"[voice-pe] connected: {info.name} (media_player key {self._media_player_key})")
        self._state.add_event("voice_pe", f"connected to {info.name}")

    async def _on_disconnect(self, expected: bool) -> None:
        self._connected.clear()
        self._session_active = False
        _log(f"[voice-pe] disconnected (expected={expected})")
        self._state.add_event("voice_pe", "disconnected — reconnecting")

    async def _prefer_wake_word(self) -> None:
        """Prefer "Hey Jarvis" when the device offers it — logged, not silent."""
        try:
            config = await self._client.get_voice_assistant_configuration(
                timeout=WAKE_WORD_CONFIG_TIMEOUT_SECONDS
            )
            available = {w.id: w.wake_word for w in config.available_wake_words}
            active = list(config.active_wake_words)
            _log(f"[voice-pe] wake words: available={list(available)} active={active}")
            if PREFERRED_WAKE_WORD in available and active != [PREFERRED_WAKE_WORD]:
                await self._client.set_voice_assistant_configuration([PREFERRED_WAKE_WORD])
                self._state.add_event(
                    "voice_pe", f"wake word set to '{available[PREFERRED_WAKE_WORD]}'"
                )
        except Exception as error:  # wake word config is a nicety, never fatal
            _log(f"[voice-pe] wake word config unavailable: {error}")

    # --- voice session (input) ---------------------------------------------------

    async def _handle_va_start(
        self, conversation_id: str, flags: int, audio_settings, wake_word_phrase
    ) -> int:
        from aioesphomeapi import VoiceAssistantEventType as Event

        self._session_active = True
        self._rechunker = FrameRechunker(self._frame_samples)  # clean slate
        _log(f"[voice-pe] wake word '{wake_word_phrase}' — session open")
        self._state.add_event("voice_pe_wake", wake_word_phrase or "")
        self._client.send_voice_assistant_event(
            Event.VOICE_ASSISTANT_RUN_START, None
        )
        self._client.send_voice_assistant_event(
            Event.VOICE_ASSISTANT_STT_START, None
        )
        return 0  # audio over the API connection, no UDP

    async def _handle_va_audio(self, data: bytes, _extra=None) -> None:
        if self._state.input_device != "voice-pe":
            return  # not the selected mic — drop, exactly like the tab does
        for frame in self._rechunker.push(data):
            self._frames.put(frame)

    async def _handle_va_stop(self, _abort: bool) -> None:
        # The device closed the session itself (its own silence detection,
        # the button, a timeout). Frames simply stop; the daemon's VAD
        # closes the utterance on silence as with any mic.
        self._session_active = False
        _log("[voice-pe] session closed by device")

    async def _end_session(self) -> None:
        from aioesphomeapi import VoiceAssistantEventType as Event

        if not self._session_active:
            return
        self._session_active = False
        self._client.send_voice_assistant_event(
            Event.VOICE_ASSISTANT_STT_END, {"text": ""}
        )
        self._client.send_voice_assistant_event(Event.VOICE_ASSISTANT_RUN_END, None)
        _log("[voice-pe] session closed (utterance complete)")

    # --- playback (output) ---------------------------------------------------------

    async def _announce(self, url: str, follow_up: bool) -> bool:
        result = await self._client.send_voice_assistant_announcement_await_response(
            media_id=url,
            timeout=ANNOUNCE_TIMEOUT_SECONDS,
            start_conversation=follow_up,
        )
        return bool(getattr(result, "success", True))

    async def _stop_media(self) -> None:
        from aioesphomeapi import MediaPlayerCommand

        if self._media_player_key is not None:
            self._client.media_player_command(
                self._media_player_key, command=MediaPlayerCommand.STOP
            )

    def _lan_ip(self) -> str:
        """The local address the speaker can reach us back on."""
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect((self._host, ESPHOME_PORT))
            return probe.getsockname()[0]


_bridge: VoicePEBridge | None = None


def bridge() -> VoicePEBridge | None:
    """The running bridge, for modules that can't be handed it (speech)."""
    return _bridge


def configured_host(settings: dict) -> str:
    return os.environ.get(HOST_ENV_VAR, "") or str(settings.get("voice_pe_host", ""))


def start_bridge(
    state: ListenerState,
    frames: "queue.Queue[np.ndarray]",
    frame_samples: int,
    host: str,
) -> VoicePEBridge | None:
    """Start the bridge when a device host is configured; None otherwise."""
    global _bridge
    if not host:
        return None
    _bridge = VoicePEBridge(state, frames, frame_samples, host)
    _log(f"[voice-pe] bridge starting for {host}")
    return _bridge
