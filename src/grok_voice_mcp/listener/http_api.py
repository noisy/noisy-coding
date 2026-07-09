"""Localhost HTTP API: transcript queue for the hooks + live dashboard."""

import json
import threading
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from grok_voice_mcp.listener.dashboard import DASHBOARD_HTML
from grok_voice_mcp.listener.state import ListenerState

DEFAULT_PORT = 8765
PORT_ENV_VAR = "GROK_VOICE_LISTENER_PORT"


def _handler_class(state: ListenerState) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            url = urlparse(self.path)
            if url.path == "/":
                self._respond_html(DASHBOARD_HTML)
            elif url.path == "/drain":
                self._respond({"transcripts": [asdict(t) for t in state.drain()]})
            elif url.path == "/events":
                since = int(parse_qs(url.query).get("since", ["0"])[0])
                self._respond({"events": state.events_since(since)})
            elif url.path == "/status":
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
                state.add_event("muted")
                self._respond({"listening": False})
            elif self.path == "/resume":
                state.set_paused(False)
                state.add_event("unmuted")
                self._respond({"listening": True})
            elif self.path == "/event":
                body = self._read_json_body()
                state.add_event(str(body.get("kind", "event")), str(body.get("detail", "")))
                self._respond({"ok": True})
            else:
                self._respond({"error": "not found"}, status=404)

        def _read_json_body(self) -> dict:
            length = int(self.headers.get("Content-Length", "0"))
            if not length:
                return {}
            try:
                return json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                return {}

        def _respond(self, body: dict, status: int = 200) -> None:
            payload = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _respond_html(self, html: str) -> None:
            payload = html.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
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
