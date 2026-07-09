"""Localhost HTTP API the Claude Code hooks poll for fresh transcripts."""

import json
import threading
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from grok_voice_mcp.listener.state import ListenerState

DEFAULT_PORT = 8765
PORT_ENV_VAR = "GROK_VOICE_LISTENER_PORT"


def _handler_class(state: ListenerState) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/drain":
                self._respond({"transcripts": [asdict(t) for t in state.drain()]})
            elif self.path == "/status":
                self._respond(
                    {
                        "listening": not state.paused,
                        "recording": state.recording,
                        "queued": state.queued_count,
                        "last_transcript_at": state.last_transcript_at,
                    }
                )
            else:
                self._respond({"error": "not found"}, status=404)

        def do_POST(self) -> None:
            if self.path == "/pause":
                state.set_paused(True)
                self._respond({"listening": False})
            elif self.path == "/resume":
                state.set_paused(False)
                self._respond({"listening": True})
            else:
                self._respond({"error": "not found"}, status=404)

        def _respond(self, body: dict, status: int = 200) -> None:
            payload = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args: object) -> None:
            pass  # keep the daemon's stdout for transcript logs only

    return Handler


def start_http_api(state: ListenerState, port: int) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", port), _handler_class(state))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server
