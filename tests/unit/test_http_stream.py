import http.client
import json

from noisy_coding.listener.http_api import start_http_api
from noisy_coding.listener.state import ListenerState


def test_set_mic_level_clamps_to_unit_range():
    state = ListenerState()

    state.set_mic_level(0.42)
    assert state.mic_level == 0.42

    state.set_mic_level(7.0)
    assert state.mic_level == 1.0

    state.set_mic_level(-1.0)
    assert state.mic_level == 0.0


def test_ptt_hold_barges_in_on_playback_only_in_ptt_mode(monkeypatch):
    import json as json_module

    from noisy_coding.listener import http_api as http_api_module

    stops = []
    monkeypatch.setattr(http_api_module.playback, "stop_all_players", lambda: stops.append(1))
    state = ListenerState()
    server = start_http_api(state, 0)
    port = server.server_address[1]

    def post_ptt_held():
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        connection.request("POST", "/ptt", body=json_module.dumps({"held": True}),
                           headers={"Content-Length": "14"})
        connection.getresponse().read()
        connection.close()

    try:
        state.set_detection_mode("auto")
        post_ptt_held()
        assert stops == []  # auto: noise must not cancel Claude's speech

        state.set_detection_mode("ptt")
        post_ptt_held()
        assert stops == [1]  # ptt: the held button outranks playback
    finally:
        server.shutdown()


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
