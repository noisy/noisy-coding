"""#97: global hotkeys never trigger the Input Monitoring prompt at boot.

The prompt ("wants to receive keystrokes from any application") appears
only on a user action - picking a key or pressing GRANT - and until it is
granted the configured keys stay disarmed and /status explains why."""

from __future__ import annotations

import pytest

from noisy_coding.listener import hotkey


class _FakeQuartz:
    def __init__(self, granted: bool, grant_on_request: bool = False):
        self.granted = granted
        self.grant_on_request = grant_on_request
        self.requests = 0

    def CGPreflightListenEventAccess(self):
        return self.granted

    def CGRequestListenEventAccess(self):
        self.requests += 1
        if self.grant_on_request:
            self.granted = True
        return self.granted


class _State:
    def refresh_ptt_hold(self): ...
    def release_ptt(self): ...
    def request_recording_abort(self): ...


@pytest.fixture
def listener(monkeypatch):
    started = []
    lst = hotkey.HotkeyListener(_State(), lambda msg: None)
    # The tap is a Quartz run loop on a thread; here it is enough to know it was asked for.
    monkeypatch.setattr(lst, "_start_tap", lambda: started.append(True) or setattr(lst, "_tap_thread", object()))
    monkeypatch.setattr(lst, "_stop_tap", lambda: setattr(lst, "_tap_thread", None))
    lst.started = started
    return lst


def test_boot_with_restored_keys_never_prompts(monkeypatch, listener):
    quartz = _FakeQuartz(granted=False)
    monkeypatch.setattr(hotkey, "_quartz", lambda: quartz)
    listener.configure("F8", "F15", "escape")  # settings restore: no user action
    assert quartz.requests == 0
    assert listener.started == []
    assert listener.snapshot() == {"configured": True, "permission": "missing", "armed": False}


def test_boot_with_permission_already_granted_arms_quietly(monkeypatch, listener):
    quartz = _FakeQuartz(granted=True)
    monkeypatch.setattr(hotkey, "_quartz", lambda: quartz)
    listener.configure("F8", "", "")
    assert quartz.requests == 0
    assert listener.snapshot()["armed"] is True


def test_picking_a_key_is_the_moment_macos_may_prompt(monkeypatch, listener):
    quartz = _FakeQuartz(granted=False, grant_on_request=True)
    monkeypatch.setattr(hotkey, "_quartz", lambda: quartz)
    listener.configure("F8", "", "", may_prompt=True)
    assert quartz.requests == 1
    assert listener.snapshot() == {"configured": True, "permission": "granted", "armed": True}


def test_grant_button_prompts_and_arms(monkeypatch, listener):
    quartz = _FakeQuartz(granted=False)
    monkeypatch.setattr(hotkey, "_quartz", lambda: quartz)
    listener.configure("F8", "", "")
    assert listener.snapshot()["armed"] is False
    quartz.grant_on_request = True
    assert listener.request_permission()["armed"] is True
    assert quartz.requests == 1


def test_refused_prompt_leaves_keys_disarmed_but_configured(monkeypatch, listener):
    quartz = _FakeQuartz(granted=False)
    monkeypatch.setattr(hotkey, "_quartz", lambda: quartz)
    listener.configure("F8", "", "", may_prompt=True)
    assert listener.snapshot() == {"configured": True, "permission": "missing", "armed": False}


def test_no_keys_means_no_probe_and_no_prompt(monkeypatch, listener):
    quartz = _FakeQuartz(granted=False)
    monkeypatch.setattr(hotkey, "_quartz", lambda: quartz)
    listener.configure("", "", "", may_prompt=True)
    assert quartz.requests == 0
    assert listener.snapshot() == {"configured": False, "permission": "unknown", "armed": False}


def test_off_macos_is_unavailable_not_missing(monkeypatch, listener):
    monkeypatch.setattr(hotkey, "_quartz", lambda: None)
    listener.configure("F8", "", "", may_prompt=True)
    assert listener.snapshot()["permission"] == "unavailable"
