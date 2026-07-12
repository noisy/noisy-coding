import http.client
import json

import pytest

from grok_voice_mcp.listener import http_api
from grok_voice_mcp.listener.http_api import start_http_api
from grok_voice_mcp.listener.state import ListenerState


@pytest.fixture
def character_server(tmp_path, monkeypatch):
    monkeypatch.setattr(http_api, "CHARACTER_FILE", tmp_path / "character.json")
    state = ListenerState()
    server = start_http_api(state, 0)
    yield state, server.server_address[1]
    server.shutdown()


def _post_character(port: int, body: dict) -> None:
    payload = json.dumps(body)
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    connection.request("POST", "/character", body=payload)
    connection.getresponse().read()
    connection.close()


def test_voice_only_change_never_reaches_the_agent(character_server):
    state, port = character_server

    _post_character(port, {"voice": "rex"})

    assert state.drain() == []


def test_trait_change_sends_one_character_instruction(character_server):
    state, port = character_server

    _post_character(port, {"humor": 90})

    transcripts = state.drain()
    assert len(transcripts) == 1
    assert transcripts[0].text.startswith("[CHARACTER]")
    assert "Never comment on the voice" in transcripts[0].text
