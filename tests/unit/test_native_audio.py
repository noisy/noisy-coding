import http.client
import json

import pytest

from noisy_coding.listener import daemon as daemon_module
from noisy_coding.listener.daemon import _migrate_native_audio_choices
from noisy_coding.listener.http_api import start_http_api
from noisy_coding.listener.state import ListenerState
from noisy_coding.listener.vad import VadConfig


def test_native_app_migrates_saved_browser_audio_choices():
    state = ListenerState()
    state.set_native_app(True)
    state.set_input_device("browser")
    state.set_output_device("browser")

    assert _migrate_native_audio_choices(state)
    assert state.input_device == ""
    assert state.output_device == "system"


def test_web_daemon_keeps_browser_audio_choices():
    state = ListenerState()
    state.set_input_device("browser")
    state.set_output_device("browser")

    assert not _migrate_native_audio_choices(state)
    assert state.input_device == "browser"
    assert state.output_device == "browser"


def test_native_settings_endpoint_normalizes_browser_audio(tmp_path, monkeypatch):
    from noisy_coding.listener import http_api

    monkeypatch.setattr(http_api, "SETTINGS_FILE", tmp_path / "settings.json")
    state = ListenerState()
    state.set_native_app(True)
    server = start_http_api(state, 0)
    port = server.server_address[1]
    try:
        body = json.dumps({"input_device": "browser", "output_device": "browser"})
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        connection.request(
            "POST",
            "/settings",
            body=body,
            headers={"Content-Length": str(len(body))},
        )
        response = connection.getresponse()
        result = json.loads(response.read())
        connection.close()
    finally:
        server.shutdown()

    assert result == {"input_device": "", "output_device": "system"}
    saved = json.loads((tmp_path / "settings.json").read_text())
    assert saved["input_device"] == ""
    assert saved["output_device"] == "system"


def test_native_app_does_not_fall_back_to_browser_when_hardware_is_missing(monkeypatch):
    def fail_to_open(**_kwargs):
        raise ValueError("no microphone")

    monkeypatch.setattr(daemon_module.sd, "InputStream", fail_to_open)
    state = ListenerState()
    state.set_native_app(True)

    with pytest.raises(ValueError, match="no microphone"):
        daemon_module._open_input_stream(state, VadConfig(), lambda *_args: None)

    assert state.input_device == ""
