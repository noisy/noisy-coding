import fcntl
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest


@pytest.fixture
def voice_endpoint(tmp_path):
    requests = []
    queues = {}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            requests.append((self.path, body))
            self.respond({"ok": True})

        def do_GET(self):
            agent = parse_qs(urlparse(self.path).query)["agent"][0]
            requests.append(("/drain", agent))
            self.respond({"transcripts": queues.pop(agent, [])})

        def respond(self, body):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps(body).encode())

    endpoint = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=endpoint.serve_forever, daemon=True)
    thread.start()
    settings = tmp_path / "codex.json"
    settings.write_text(json.dumps({"port": endpoint.server_port, "listen_seconds": 0.1}))
    environment = {key: value for key, value in os.environ.items()
                   if not key.startswith("NOISY_CODING_")}
    environment.update(HOME=str(tmp_path), NOISY_CODING_CODEX_CONFIG=str(settings),
                       NOISY_CODING_REWAKE_GRACE_SECONDS="0")

    def run_hook(event, agent="codex-a", **extra):
        payload = {"hook_event_name": event, "session_id": agent, "cwd": str(tmp_path), **extra}
        return subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[2] / "hooks/codex.py")],
            input=json.dumps(payload), capture_output=True, text=True, env=environment,
            cwd=tmp_path, timeout=5,
        )

    yield run_hook, requests, queues, settings
    endpoint.shutdown()
    endpoint.server_close()
    thread.join()


def test_shared_hooks_deliver_voice_to_two_sessions_in_one_directory(voice_endpoint, tmp_path):
    run_hook, requests, queues, _settings = voice_endpoint
    queues.update({"codex-a": [{"text": "alpha"}], "codex-b": [{"text": "beta"}]})

    first = run_hook("PostToolUse")
    second = run_hook("Stop", "codex-b")

    assert first.returncode == 0
    assert "alpha" in json.loads(first.stdout)["hookSpecificOutput"]["additionalContext"]
    assert (second.returncode, "beta" in second.stderr, "alpha" in second.stderr) == (2, True, False)
    assert [body for path, body in requests if path == "/drain"] == ["codex-a", "codex-b"]
    assert not (tmp_path / ".config/noisy-coding/sessions.json").exists()


def test_disabled_idle_listening_clears_activity_without_draining(voice_endpoint):
    run_hook, requests, queues, settings = voice_endpoint
    config = json.loads(settings.read_text())
    settings.write_text(json.dumps({**config, "listen_seconds": 0}))
    queues["codex-a"] = [{"text": "keep for the next tool"}]

    result = run_hook("Stop")

    assert (result.returncode, result.stdout, result.stderr) == (0, "", "")
    assert [(path, body) for path, body in requests if path != "/register"] == [
        ("/activity", {"agent": "codex-a", "text": ""}),
    ]


def test_duplicate_listener_reports_the_conflict_without_consuming_voice(voice_endpoint, tmp_path):
    run_hook, requests, queues, _settings = voice_endpoint
    lock_path = tmp_path / ".config/noisy-coding/rewake-codex-a.lock"
    lock_path.parent.mkdir(parents=True)
    queues["codex-a"] = [{"text": "keep for the first listener"}]

    with lock_path.open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = run_hook("Stop")

    assert "already active" in json.loads(result.stdout)["systemMessage"]
    assert [body["kind"] for path, body in requests if path == "/event"] == ["voice_listener_error"]
    assert queues == {"codex-a": [{"text": "keep for the first listener"}]}
