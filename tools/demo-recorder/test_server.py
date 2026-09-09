import importlib.util
import json
from pathlib import Path
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location("recorder_server", Path(__file__).with_name("server.py"))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


def test_finish_preserves_partial_revisions_and_final_utterance_identity():
    sent = []
    session = Mock()
    session.finish.return_value = "how is staging?"

    def factory(rate, language, on_partial):
        assert (rate, language) == (48000, "en")
        on_partial("how")
        on_partial("how is staging")
        return session

    socket = Mock()
    socket.__iter__ = Mock(return_value=iter([
        json.dumps({"type": "start", "utterance": "u1", "sampleRate": 48000}),
        b"pcm1", json.dumps({"type": "finish"}),
    ]))
    socket.send.side_effect = lambda message: sent.append(json.loads(message))

    server.transcribe_connection(socket, factory)

    assert sent == [
        {"type": "transcript", "utterance": "u1", "text": "how", "final": False},
        {"type": "transcript", "utterance": "u1", "text": "how is staging", "final": False},
        {"type": "ready", "utterance": "u1"},
        {"type": "transcript", "utterance": "u1", "text": "how is staging?", "final": True},
    ]
    session.send.assert_called_once_with(b"pcm1")
    session.abort.assert_not_called()


def test_disconnect_aborts_open_provider_session():
    session = Mock()
    socket = Mock()
    socket.__iter__ = Mock(return_value=iter([
        json.dumps({"type": "start", "utterance": "u2", "sampleRate": 48000}),
    ]))

    server.transcribe_connection(socket, lambda *_args: session)

    session.abort.assert_called_once_with()


def test_provider_errors_do_not_expose_credentials():
    socket = Mock()
    socket.__iter__ = Mock(return_value=iter([
        json.dumps({"type": "start", "utterance": "u3", "sampleRate": 48000}),
    ]))

    server.transcribe_connection(socket, Mock(side_effect=RuntimeError("secret-test-key")))

    assert "secret-test-key" not in socket.send.call_args.args[0]
    assert json.loads(socket.send.call_args.args[0])["type"] == "error"
