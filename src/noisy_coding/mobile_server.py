"""Standalone mobile dashboard server.

Runs as its own process (default port 8770), independent of the listener
daemon — restart it freely without forcing agents to reconnect. Serves the
built Vue HUD's mobile companion (the /m route of dashboard/dist) and
proxies the daemon endpoints that page needs (127.0.0.1:8765), so it can be
exposed via ngrok without exposing the daemon.

Run: uv run noisy-coding-mobile   (then: ngrok http 8770)
"""

import os
import socket
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MOBILE_PORT = int(os.environ.get("NOISY_CODING_MOBILE_PORT", "8770"))
LISTENER_PORT = int(os.environ.get("NOISY_CODING_LISTENER_PORT", "8765"))
DAEMON = f"http://127.0.0.1:{LISTENER_PORT}"
# The daemon's tab-audio WS bridge listens one port above its HTTP API.
BRIDGE_PORT = LISTENER_PORT + 1

DIST_DIR = Path(__file__).resolve().parents[2] / "dashboard" / "dist"
BUILD_HINT = (
    b"<h1>noisy-coding mobile</h1>"
    b"<p>dashboard/dist not built. Run: <code>cd dashboard && npm install "
    b"&& npm run build</code>, then reload.</p>"
)
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".map": "application/json",
    ".woff2": "font/woff2",
}

# The whole daemon API is NOT exposed: only what the mobile page uses.
PROXY_GET = {"/status", "/utterances", "/character", "/events"}
PROXY_POST = {"/mute", "/ptt", "/active-agent"}


def _daemon_get(path: str) -> bytes:
    with urllib.request.urlopen(f"{DAEMON}{path}", timeout=1.0) as r:
        return r.read()


def _daemon_post(path: str, body: bytes) -> bytes:
    req = urllib.request.Request(f"{DAEMON}{path}", data=body, method="POST")
    with urllib.request.urlopen(req, timeout=1.0) as r:
        return r.read()


class Handler(BaseHTTPRequestHandler):
    # Unbuffered rfile: /bridge splices the raw socket after the handshake,
    # and a buffered reader would swallow WS frames that arrive right
    # behind the Upgrade request (the client's "hello" — losing it costs
    # the tab its audio lease).
    rbufsize = 0

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/bridge":
            self._proxy_ws()
        elif path in ("/", "/m/"):
            self.send_response(301)
            self.send_header("Location", "/m")
            self.end_headers()
        elif path == "/m":
            self._serve_dist_file("index.html")
        elif path in PROXY_GET:
            self._proxy(lambda: _daemon_get(self.path))
        else:
            self._serve_dist_file(path.lstrip("/"))

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in PROXY_POST:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length else b"{}"
            self._proxy(lambda: _daemon_post(self.path, body))
        else:
            self._send(404, "application/json", b'{"error":"not found"}')

    def _serve_dist_file(self, relative: str) -> None:
        if not DIST_DIR.is_dir():
            self._send(200, "text/html; charset=utf-8", BUILD_HINT)
            return
        target = (DIST_DIR / relative).resolve()
        # Never serve anything outside dist (path traversal guard).
        if not target.is_relative_to(DIST_DIR.resolve()) or not target.is_file():
            self._send(404, "application/json", b'{"error":"not found"}')
            return
        ctype = CONTENT_TYPES.get(target.suffix, "application/octet-stream")
        self._send(200, ctype, target.read_bytes())

    def _proxy_ws(self) -> None:
        """Splice this connection onto the daemon's tab-audio WS bridge.

        A single tunneled port (ngrok) can't reach the bridge's own port,
        so /bridge replays the client's Upgrade handshake against the
        daemon and then pipes raw bytes both ways — the WS protocol itself
        passes through untouched.
        """
        try:
            upstream = socket.create_connection(("127.0.0.1", BRIDGE_PORT), timeout=5)
        except OSError:
            self._send(502, "application/json", b'{"error":"bridge unreachable"}')
            return
        handshake = [f"GET / HTTP/1.1\r\nHost: 127.0.0.1:{BRIDGE_PORT}\r\n"]
        handshake += [
            f"{name}: {value}\r\n"
            for name, value in self.headers.items()
            if name.lower() != "host"
        ]
        handshake.append("\r\n")
        upstream.sendall("".join(handshake).encode("latin-1"))

        client = self.connection

        def pipe(src: socket.socket, dst: socket.socket) -> None:
            try:
                while True:
                    data = src.recv(65536)
                    if not data:
                        break
                    dst.sendall(data)
            except OSError:
                pass
            finally:
                for sock in (src, dst):
                    try:
                        sock.shutdown(socket.SHUT_RDWR)
                    except OSError:
                        pass

        downstream = threading.Thread(target=pipe, args=(upstream, client), daemon=True)
        downstream.start()
        pipe(client, upstream)
        downstream.join()
        self.close_connection = True

    def _proxy(self, call) -> None:
        try:
            self._send(200, "application/json", call())
        except (urllib.error.URLError, OSError):
            self._send(502, "application/json", b'{"error":"daemon unreachable"}')

    def _send(self, status: int, ctype: str, payload: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args: object) -> None:
        pass


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", MOBILE_PORT), Handler)
    print(f"noisy-coding-mobile on http://0.0.0.0:{MOBILE_PORT} → daemon {DAEMON}", flush=True)
    print(f"Expose it:  ngrok http {MOBILE_PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
