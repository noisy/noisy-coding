import http.client
import json

from grok_voice_mcp.listener.http_api import start_http_api
from grok_voice_mcp.listener.state import ListenerState


def test_set_mic_level_clamps_to_unit_range():
    state = ListenerState()

    state.set_mic_level(0.42)
    assert state.mic_level == 0.42

    state.set_mic_level(7.0)
    assert state.mic_level == 1.0

    state.set_mic_level(-1.0)
    assert state.mic_level == 0.0


def test_stream_mic_serves_sse_frames_with_level_and_recording():
    state = ListenerState()
    state.set_mic_level(0.5)
    state.set_recording(True)
    server = start_http_api(state, 0)
    port = server.server_address[1]

    try:
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        connection.request("GET", "/stream/mic")
        response = connection.getresponse()

        assert response.status == 200
        assert response.getheader("Content-Type") == "text/event-stream"
        line = response.fp.readline().decode()
        assert line.startswith("data: ")
        frame = json.loads(line[len("data: "):])
        assert frame == {"level": 0.5, "recording": True}

        connection.close()
    finally:
        server.shutdown()
