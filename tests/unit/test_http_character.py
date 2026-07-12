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


def test_same_gender_voice_change_never_reaches_the_agent(character_server):
    state, port = character_server

    _post_character(port, {"voice": "luna"})  # default carina (f) → luna (f)

    assert state.drain() == []


def test_trait_change_sends_one_character_instruction(character_server):
    state, port = character_server

    _post_character(port, {"humor": 90})

    transcripts = state.drain()
    assert len(transcripts) == 1
    assert transcripts[0].text.startswith("[CHARACTER]")
    assert "Never comment on the voice" in transcripts[0].text


def test_gender_flip_sends_a_silent_persona_instruction(character_server):
    state, port = character_server

    _post_character(port, {"voice": "ara"})  # default carina (f) → ara (f)
    assert state.drain() == []  # same gender — nothing to apply

    _post_character(port, {"voice": "rex"})  # female → male
    transcripts = state.drain()
    assert len(transcripts) == 1
    assert transcripts[0].text.startswith("[PERSONA]")
    assert "male" in transcripts[0].text
    assert "silently" in transcripts[0].text
