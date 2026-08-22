"""System-wide push-to-talk hotkeys (#25).

A Quartz event tap sees the configured keys no matter which app has
focus and drives the SAME push-to-talk lease the dashboard button uses:

- hold-to-talk:   key down opens the lease, key up releases it;
- toggle-to-talk: one press opens, the next press releases.

macOS only (the tap needs the Accessibility permission - System
Settings > Privacy & Security > Accessibility - for the process that
runs the daemon, typically your terminal). On other platforms, or when
no key is configured, this module is a silent no-op.

The lease is renewed from a small thread while engaged, exactly like
the dashboard's ~2x/s heartbeat, so daemon-side expiry keeps working
if this process dies mid-hold.
"""

from __future__ import annotations

import threading
from typing import Callable, Protocol

# Key NAMES are what settings store - keycodes are a macOS detail.
# Deliberately a safe list: keys that don't type characters in editors.
KEYCODES: dict[str, int] = {
    "F13": 105, "F14": 107, "F15": 113, "F16": 106,
    "F17": 64, "F18": 79, "F19": 80,
    "F6": 97, "F7": 98, "F8": 100,
    "right_cmd": 54, "right_option": 61, "right_ctrl": 62,
    # escape types nothing, and scratch is a no-op unless recording - so a
    # global Escape binding is side-effect-free in other apps.
    "escape": 53,
}
# Modifier keys never emit keyDown/keyUp - only flagsChanged.
_MODIFIER_KEYS = {"right_cmd", "right_option", "right_ctrl"}

LEASE_RENEW_SECONDS = 0.4  # matches the dashboard's heartbeat cadence


class _PttState(Protocol):
    def refresh_ptt_hold(self) -> None: ...
    def release_ptt(self) -> None: ...
    def request_recording_abort(self) -> None: ...


class HotkeyListener:
    """Owns the event tap thread and the lease-renewal thread."""

    def __init__(self, state: _PttState, log: Callable[[str], None]) -> None:
        self._state = state
        self._log = log
        self._lock = threading.Lock()
        self._hold_key: int | None = None
        self._toggle_key: int | None = None
        self._cancel_key: int | None = None
        self._modifier_down: set[int] = set()
        self._engaged = False          # lease currently open (either mode)
        self._toggle_latched = False   # toggle mode: waiting for 2nd press
        self._tap_thread: threading.Thread | None = None
        self._renew_thread: threading.Thread | None = None
        self._restart = None  # CFRunLoop stop handle, set by the tap thread

    # -- configuration ----------------------------------------------------

    def configure(self, hold_key: str, toggle_key: str, cancel_key: str = "") -> None:
        """Apply key names from settings; restarts the tap as needed."""
        with self._lock:
            self._hold_key = KEYCODES.get(hold_key)
            self._toggle_key = KEYCODES.get(toggle_key)
            self._cancel_key = KEYCODES.get(cancel_key)
            self._hold_name, self._toggle_name = hold_key, toggle_key
            self._cancel_name = cancel_key
            wanted = any(
                k is not None for k in (self._hold_key, self._toggle_key, self._cancel_key)
            )
        self._disengage()
        self._stop_tap()
        if wanted:
            self._start_tap()

    # -- lease driving -----------------------------------------------------

    def _engage(self) -> None:
        with self._lock:
            if self._engaged:
                return
            self._engaged = True
        self._state.refresh_ptt_hold()
        self._renew_thread = threading.Thread(target=self._renew_loop, daemon=True)
        self._renew_thread.start()

    def _disengage(self) -> None:
        with self._lock:
            was = self._engaged
            self._engaged = False
            self._toggle_latched = False
        if was:
            self._state.release_ptt()

    def _renew_loop(self) -> None:
        import time

        while True:
            with self._lock:
                if not self._engaged:
                    return
            self._state.refresh_ptt_hold()
            time.sleep(LEASE_RENEW_SECONDS)

    # -- the tap -----------------------------------------------------------

    def _on_key(self, keycode: int, down: bool) -> None:
        if keycode == self._cancel_key and down:
            # Scratch-my-words: abort the recording in ANY mode, and if the
            # toggle latch is open, close it - the turn is over either way.
            self._state.request_recording_abort()
            self._disengage()
            return
        if keycode == self._hold_key:
            if down:
                self._engage()
            else:
                self._disengage()
        elif keycode == self._toggle_key and down:
            if self._toggle_latched:
                self._disengage()
            else:
                with self._lock:
                    self._toggle_latched = True
                self._engage()

    def _start_tap(self) -> None:
        try:
            import Quartz
        except ImportError:
            self._log("hotkey: Quartz unavailable (non-macOS) — global PTT off")
            return

        def run() -> None:
            watched_modifiers = {
                code
                for name, code in KEYCODES.items()
                if name in _MODIFIER_KEYS
                and code in (self._hold_key, self._toggle_key, self._cancel_key)
            }

            def callback(_proxy, event_type, event, _refcon):
                keycode = Quartz.CGEventGetIntegerValueField(
                    event, Quartz.kCGKeyboardEventKeycode
                )
                if event_type == Quartz.kCGEventFlagsChanged:
                    if keycode in watched_modifiers:
                        down = keycode not in self._modifier_down
                        if down:
                            self._modifier_down.add(keycode)
                        else:
                            self._modifier_down.discard(keycode)
                        self._on_key(keycode, down)
                elif event_type in (Quartz.kCGEventKeyDown, Quartz.kCGEventKeyUp):
                    # Ignore key-repeat: a held F-key fires repeats that
                    # would flap the toggle.
                    if event_type == Quartz.kCGEventKeyDown and Quartz.CGEventGetIntegerValueField(
                        event, Quartz.kCGKeyboardEventAutorepeat
                    ):
                        return event
                    self._on_key(keycode, event_type == Quartz.kCGEventKeyDown)
                return event  # listen-only: never swallow the key

            mask = (
                Quartz.CGEventMaskBit(Quartz.kCGEventKeyDown)
                | Quartz.CGEventMaskBit(Quartz.kCGEventKeyUp)
                | Quartz.CGEventMaskBit(Quartz.kCGEventFlagsChanged)
            )
            tap = Quartz.CGEventTapCreate(
                Quartz.kCGSessionEventTap,
                Quartz.kCGHeadInsertEventTap,
                Quartz.kCGEventTapOptionListenOnly,
                mask,
                callback,
                None,
            )
            if tap is None:
                self._log(
                    "hotkey: event tap refused — grant Accessibility permission "
                    "to the daemon's terminal (System Settings > Privacy & Security)"
                )
                return
            source = Quartz.CFMachPortCreateRunLoopSource(None, tap, 0)
            loop = Quartz.CFRunLoopGetCurrent()
            Quartz.CFRunLoopAddSource(loop, source, Quartz.kCFRunLoopCommonModes)
            Quartz.CGEventTapEnable(tap, True)
            self._restart = loop
            self._log(
                f"hotkey: global PTT armed (hold={self._hold_name or '-'}, "
                f"toggle={self._toggle_name or '-'}, cancel={self._cancel_name or '-'})"
            )
            Quartz.CFRunLoopRun()

        self._tap_thread = threading.Thread(target=run, daemon=True, name="ptt-hotkey")
        self._tap_thread.start()

    def _stop_tap(self) -> None:
        loop = self._restart
        if loop is not None:
            try:
                import Quartz

                Quartz.CFRunLoopStop(loop)
            except Exception:
                pass
            self._restart = None
        self._tap_thread = None
