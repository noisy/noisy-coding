"""#99: the dashboard tab as microphone/speaker is opt-in; the native app
never offers it, and a "browser" pick stored by an older build migrates
back to the system devices instead of raising the ENABLE TAB AUDIO banner."""

from __future__ import annotations

from noisy_coding.listener.state import ListenerState


def _events(state: ListenerState) -> list[str]:
    return [e["detail"] for e in state.events_since(0) if e["kind"] == "settings_migrated"]


def test_browser_picks_are_refused_by_default():
    state = ListenerState()
    assert state.browser_audio is False
    assert state.set_input_device("browser") == ""
    assert state.set_output_device("browser") == "system"


def test_browser_picks_are_honoured_when_enabled():
    state = ListenerState()
    state.set_browser_audio(True)
    assert state.set_input_device("browser") == "browser"
    assert state.set_output_device("browser") == "browser"


def test_disabling_migrates_stored_picks_and_says_so():
    state = ListenerState()
    state.set_browser_audio(True)
    state.set_input_device("browser")
    state.set_output_device("browser")
    state.set_browser_audio(False)
    assert state.input_device == ""
    assert state.output_device == "system"
    assert _events(state) == [
        "browser-tab microphone and speaker is not available here - using the system devices"
    ]


def test_disabling_with_native_picks_is_silent():
    state = ListenerState()
    state.set_input_device("Jabra Link 380")
    state.set_browser_audio(False)
    assert state.input_device == "Jabra Link 380"
    assert _events(state) == []
