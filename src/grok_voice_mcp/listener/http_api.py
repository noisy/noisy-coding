"""Localhost HTTP API: transcript queue for the hooks + live dashboard."""

import json
import os
import subprocess
import sys
import threading
import time
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from grok_voice_mcp import credentials, playback
from grok_voice_mcp.listener import pricing, speech
from grok_voice_mcp.listener.dashboard import DASHBOARD_HTML
from grok_voice_mcp.listener.state import ListenerState

DEFAULT_PORT = 8765
# Bind address. Loopback by default; a Docker container must bind 0.0.0.0
# or the published port can't reach it (set GROK_VOICE_BIND=0.0.0.0 there).
BIND_ENV_VAR = "GROK_VOICE_BIND"
# Mic-level frame cadence for the dashboard oscilloscope (~20 fps). A data
# rate for smooth rendering, not coordination logic.
MIC_STREAM_INTERVAL_SECONDS = 0.05
# The built Vue HUD (dashboard/dist) served at /next; legacy stays at /.
DIST_DIR = Path(__file__).resolve().parents[3] / "dashboard" / "dist"
STATIC_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".map": "application/json",
}
BUILD_HINT_HTML = """<!doctype html><meta charset="utf-8">
<body style="font-family:monospace;background:#02060c;color:#cfeaf6;padding:40px">
<h2>HUD not built yet</h2>
<p>Run: <code>cd dashboard &amp;&amp; npm install &amp;&amp; npm run build</code>, then reload.</p>
</body>"""
PORT_ENV_VAR = "GROK_VOICE_LISTENER_PORT"
CHARACTER_FILE = Path.home() / ".config" / "grok-voice" / "character.json"
SETTINGS_FILE = Path.home() / ".config" / "grok-voice" / "settings.json"


# Grok voice genders (matches the dashboard's voice list). The agent's
# Polish grammar must agree with the voice it speaks with.
FEMALE_VOICES = {"ara", "carina", "celeste", "eve", "iris", "luna", "ursa"}


def _voice_gender(voice: str) -> str:
    return "female" if voice in FEMALE_VOICES else "male"


def notify_gender_change(
    state: ListenerState, agent: str | None, old_voice: str, new_voice: str
) -> None:
    """Tell the agent to switch grammatical gender — silently.

    Sent only when the voice's gender actually flips, and phrased so the
    agent applies it without ever commenting on it.
    """
    if _voice_gender(old_voice) == _voice_gender(new_voice):
        return
    if agent not in (None, state.active_agent):
        return
    gender = _voice_gender(new_voice)
    forms = "feminine (e.g. „zrobiłam”)" if gender == "female" else "masculine (e.g. „zrobiłem”)"
    state.add_transcript(
        f"[PERSONA] Your voice is now {gender}. From this point on, speak and write "
        f"in the first person using {forms} grammatical forms in Polish. Apply this "
        "silently: never mention, comment on, or acknowledge the voice change or "
        "this note — just continue whatever is pending as if it did not exist."
    )


def list_input_devices() -> list:
    """Fresh input-device list via a subprocess.

    A new PortAudio instance sees devices plugged in after the daemon
    started; the daemon's own (cached) instance would not — and it cannot
    be re-initialized while the input stream is running.
    """
    script = (
        "import json, sounddevice as sd; devices = sd.query_devices(); "
        "default_in = sd.default.device[0]; "
        "print(json.dumps([{'name': d['name'], 'default': i == default_in} "
        "for i, d in enumerate(devices) if d['max_input_channels'] > 0]))"
    )
    try:
        result = subprocess.run(
            [sys.executable, "-c", script], capture_output=True, timeout=10
        )
        return json.loads(result.stdout)
    except (OSError, ValueError, subprocess.SubprocessError):
        return []


def save_characters(state: ListenerState) -> None:
    """Persist per-agent characters so voice choices survive restarts."""
    try:
        CHARACTER_FILE.parent.mkdir(parents=True, exist_ok=True)
        CHARACTER_FILE.write_text(json.dumps(state.all_characters()))
    except OSError:
        pass


def save_settings(state: ListenerState) -> None:
    """Persist tuning that must survive daemon restarts."""
    try:
        SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_FILE.write_text(
            json.dumps(
                {
                    "end_silence_ms": state.end_silence_ms,
                    "smart_turn": state.smart_turn,
                    "mode": state.mode,
                    "tts_mode": state.tts_mode,
                    "smart_turn_mode": state.smart_turn_mode,
                    "detection_mode": state.detection_mode,
                    "input_device": state.input_device,
                    "language": state.language,
                }
            )
        )
    except OSError:
        pass


def _handler_class(state: ListenerState) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            url = urlparse(self.path)
            if url.path == "/":
                # The Vue HUD is the main dashboard; the legacy one stays
                # at /legacy (and serves as fallback before the first build).
                if DIST_DIR.is_dir():
                    self._serve_hud_file("index.html")
                else:
                    self._respond_html(DASHBOARD_HTML)
            elif url.path == "/legacy":
                self._respond_html(DASHBOARD_HTML)
            elif url.path.startswith("/assets/"):
                self._serve_hud_file(url.path[1:])
            elif url.path == "/drain":
                agent = parse_qs(url.query).get("agent", [None])[0]
                self._respond(
                    {"transcripts": [asdict(t) for t in state.drain(agent)]}
                )
            elif url.path == "/events":
                since = int(parse_qs(url.query).get("since", ["0"])[0])
                self._respond({"events": state.events_since(since)})
            elif url.path == "/utterances":
                agent = parse_qs(url.query).get("agent", [None])[0]
                self._respond({"utterances": state.utterances(agent)})
            elif url.path == "/character":
                agent = parse_qs(url.query).get("agent", [None])[0]
                self._respond({"character": state.character(agent)})
            elif url.path == "/devices":
                self._respond(
                    {"devices": list_input_devices(), "selected": state.input_device}
                )
            elif url.path == "/stream/mic":
                self._stream_mic_levels()
            elif url.path == "/next":
                self.send_response(301)
                self.send_header("Location", "/next/")
                self.end_headers()
            elif url.path.startswith("/next/"):
                self._serve_hud_file(url.path[len("/next/"):] or "index.html")
            elif url.path == "/status":
                self._respond(
                    {
                        "listening": not state.paused,
                        "muted": state.user_muted,
                        "voice_muted": state.voice_muted,
                        "api_key_set": bool(credentials.api_key()),
                        "api_key_hint": credentials.api_key_hint(),
                        "recording": state.recording,
                        "claude_speaking": state.claude_speaking,
                        "playing_utterance_id": state.playing_utterance_id,
                        "stt_latency_ms": state.latency_ms["stt"],
                        "tts_latency_ms": state.latency_ms["tts"],
                        "speaking_agents": state.speaking_agents,
                        "queued": state.queued_count,
                        "last_transcript_at": state.last_transcript_at,
                        "session_cost_usd": state.session_cost_usd,
                        "usage": state.usage,
                        "credits_usd": state.credits_usd,
                        "mode": state.mode,
                        "tts_mode": state.tts_mode,
                        "end_silence_ms": state.end_silence_ms,
                        "smart_turn": state.smart_turn,
                        "smart_turn_mode": state.smart_turn_mode,
                        "detection_mode": state.detection_mode,
                        "ptt_held": state.ptt_held,
                        "input_device": state.input_device,
                        "language": state.language,
                        "agents": state.agents,
                        "agent_labels": state.agent_labels,
                        "active_agent": state.active_agent,
                    }
                )
            else:
                self._respond({"error": "not found"}, status=404)

        def do_POST(self) -> None:
            if self.path == "/register":
                body = self._read_json_body()
                name = str(body.get("name", "")).strip()
                label = str(body.get("label", "")).strip()
                if name:
                    already = name in state.agents
                    state.register_agent(name, label)
                    if not already:  # avoid spamming the event log every hook fire
                        state.add_event("agent", f"'{label or name}' registered")
                    self._respond(
                        {"registered": name, "active_agent": state.active_agent}
                    )
                else:
                    self._respond({"error": "name required"}, status=400)
            elif self.path == "/active-agent":
                name = str(self._read_json_body().get("name", "")).strip()
                active = state.set_active_agent(name)
                state.add_event("agent", f"switched to '{active}'")
                self._respond({"active_agent": active})
            elif self.path == "/pause":
                state.set_paused(True)
                state.add_event("muted")
                self._respond({"listening": False})
            elif self.path == "/resume":
                state.set_paused(False)
                state.add_event("unmuted")
                self._respond({"listening": True})
            elif self.path == "/character":
                body = self._read_json_body()
                agent = body.get("agent")  # which tab's character (None=active)
                before = state.character(agent)
                values = state.set_character(body, agent)
                traits = ", ".join(
                    f"{k} {v}/100"
                    for k, v in values.items()
                    if k not in ("voice", "speed")
                )
                summary = (
                    f"{traits}, voice '{values['voice']}', speed {values['speed']}x"
                )
                state.add_event("character", summary)
                # The agent is told ONLY about trait changes (they shape its
                # style, a brief in-character ack is welcome). Voice and
                # speed are the daemon's business — switching them must
                # never provoke a comment from Claude.
                traits_changed = any(
                    before.get(k) != values.get(k)
                    for k in values
                    if k not in ("voice", "speed")
                )
                # The instruction reaches the agent via its queue only if it's
                # the active one; editing a background tab just stores the values.
                if traits_changed and agent in (None, state.active_agent):
                    state.add_transcript(
                        f"[CHARACTER] The user moved your character sliders to: {summary}. "
                        "Adjust the style of your spoken and written replies accordingly "
                        "— the daemon applies the voice and speed to your speech by "
                        "itself — and briefly acknowledge the new setting in character. "
                        "Never comment on the voice or speed."
                    )
                notify_gender_change(state, agent, before["voice"], values["voice"])
                save_characters(state)
                self._respond({"character": values})
            elif self.path == "/voice":
                # Claude's deliberate voice switch (the change_voice tool):
                # updates this agent's character, so the dashboard shows it
                # and every later speak uses it. Speak itself carries no
                # voice information.
                body = self._read_json_body()
                voice = str(body.get("voice_id", "")).strip().lower()
                if not voice.isalpha():
                    self._respond({"error": "voice_id must be a voice name"}, status=400)
                else:
                    agent = str(body["agent"]) if body.get("agent") else None
                    before_voice = state.character(agent)["voice"]
                    values = state.set_character({"voice": voice}, agent)
                    state.add_event("voice", f"Claude switched voice to '{values['voice']}'")
                    notify_gender_change(state, agent, before_voice, values["voice"])
                    save_characters(state)
                    self._respond({"voice": values["voice"]})
            elif self.path == "/settings":
                body = self._read_json_body()
                result = {}
                if "end_silence_ms" in body:
                    result["end_silence_ms"] = state.set_end_silence_ms(
                        body["end_silence_ms"]
                    )
                if "smart_turn" in body:
                    result["smart_turn"] = state.set_smart_turn(body["smart_turn"])
                if body.get("tts_mode") in ("batch", "live"):
                    state.set_tts_mode(body["tts_mode"])
                    result["tts_mode"] = body["tts_mode"]
                if body.get("smart_turn_mode") in ("soft", "hard"):
                    result["smart_turn_mode"] = state.set_smart_turn_mode(
                        body["smart_turn_mode"]
                    )
                if body.get("detection_mode") in ("auto", "ptt"):
                    result["detection_mode"] = state.set_detection_mode(
                        body["detection_mode"]
                    )
                    if result["detection_mode"] == "auto":
                        state.release_ptt()  # leaving PTT never leaves a stale hold
                if "language" in body:
                    result["language"] = state.set_language(str(body["language"]))
                if "input_device" in body:
                    result["input_device"] = state.set_input_device(str(body["input_device"]))
                if result:
                    save_settings(state)
                    self._respond(result)
                else:
                    self._respond({"error": "no known setting in body"}, status=400)
            elif self.path == "/speaking":
                body = self._read_json_body()
                speaking = bool(body.get("speaking", False))
                state.set_claude_speaking(speaking, body.get("agent"))
                self._respond({"speaking": speaking})
            elif self.path == "/speak":
                self._handle_speak()
            elif self.path == "/interrupt":
                # Stop whatever is on the speakers; queued speech continues.
                playback.stop_all_players()
                self._respond({"stopped": True})
            elif self.path == "/cancel":
                utterance_id = int(self._read_json_body().get("utterance_id", 0))
                self._respond({"cancelled": state.cancel_transcript(utterance_id)})
            elif self.path == "/ptt":
                # Lease renewal/release for push-to-talk; the UI renews
                # while the button is held (see PTT_LEASE_SECONDS).
                if bool(self._read_json_body().get("held", False)):
                    state.refresh_ptt_hold()
                    # The held button IS the user's turn: it overrides any
                    # playback, and each renewal re-silences anything that
                    # dared to start. AUTO mode deliberately has no such
                    # barge-in — room noise must not cancel Claude's speech.
                    if state.detection_mode == "ptt":
                        playback.stop_all_players()
                else:
                    state.release_ptt()
                self._respond({"held": state.ptt_held})
            elif self.path == "/credentials":
                key = str(self._read_json_body().get("xai_api_key", "")).strip()
                if len(key) < 8:
                    self._respond({"error": "that does not look like an API key"}, status=400)
                else:
                    credentials.save_api_key(key)
                    state.add_event("credentials", "xAI API key configured")
                    self._respond({"api_key_set": True, "api_key_hint": credentials.api_key_hint()})
            elif self.path == "/voice-mute":
                muted = bool(self._read_json_body().get("muted", True))
                state.set_voice_muted(muted)
                state.add_event("voice_muted" if muted else "voice_unmuted")
                self._respond({"voice_muted": muted})
            elif self.path == "/mute":
                muted = bool(self._read_json_body().get("muted", True))
                state.set_user_muted(muted)
                state.add_event("muted" if muted else "unmuted")
                self._respond({"muted": muted})
            elif self.path == "/mode":
                body = self._read_json_body()
                mode = str(body.get("mode", ""))
                if mode in ("batch", "live"):
                    state.set_mode(mode)
                    state.add_event("mode", f"transcription mode switched to {mode}")
                    save_settings(state)
                    self._respond({"mode": mode})
                else:
                    self._respond({"error": "mode must be 'batch' or 'live'"}, status=400)
            elif self.path == "/event":
                body = self._read_json_body()
                kind = str(body.get("kind", "event"))
                detail = str(body.get("detail", ""))
                state.add_event(kind, detail)
                self._track_speak_utterance(kind, detail, body)
                self._respond({"ok": True})
            else:
                self._respond({"error": "not found"}, status=404)

        def _serve_hud_file(self, relative: str) -> None:
            if not DIST_DIR.is_dir():
                self._respond_html(BUILD_HINT_HTML)
                return
            target = (DIST_DIR / relative).resolve()
            # Never serve anything outside dist (path traversal guard).
            if not target.is_relative_to(DIST_DIR.resolve()) or not target.is_file():
                self._respond({"error": "not found"}, status=404)
                return
            payload = target.read_bytes()
            self.send_response(200)
            self.send_header(
                "Content-Type",
                STATIC_CONTENT_TYPES.get(target.suffix, "application/octet-stream"),
            )
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _stream_mic_levels(self) -> None:
            # Server-sent events: ONE long-lived connection per dashboard
            # tab instead of high-frequency polling. ThreadingHTTPServer
            # gives the stream its own (daemon) thread; the browser's
            # EventSource reconnects on its own after daemon restarts.
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            try:
                while True:
                    payload = json.dumps(
                        {"level": state.mic_level, "recording": state.recording}
                    )
                    self.wfile.write(f"data: {payload}\n\n".encode())
                    self.wfile.flush()
                    time.sleep(MIC_STREAM_INTERVAL_SECONDS)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass  # client went away — just end the stream

        def _handle_speak(self) -> None:
            # Body: {text, voice_id?, language?, speed?, interrupt?, agent?,
            # wait?}. wait=true (default) blocks until the utterance has
            # played — that's the `speak` tool's "wait until it's said"
            # semantics; wait=false is `announce` (fire-and-forget).
            body = self._read_json_body()
            text = str(body.get("text", "")).strip()
            if not text:
                self._respond({"error": "text required"}, status=400)
                return
            future = speech.submit(
                state,
                text,
                agent=str(body["agent"]) if body.get("agent") else None,
                card=bool(body.get("card", True)),
                source_id=int(body.get("source_id", 0)),
            )
            if future is None:
                # This bubble is already queued/playing — repeated clicks
                # must not stack replays (nor interrupt the one in flight).
                self._respond({"skipped": True})
                return
            if body.get("interrupt"):
                playback.stop_all_players()  # cut the current utterance short
            if not body.get("wait", True):
                self._respond({"queued": True})
                return
            try:
                voice = future.result()
            except Exception as error:  # surface synth/playback failure to caller
                self._respond({"error": str(error)[:300]}, status=500)
                return
            self._respond({"voice": voice})

        def _track_speak_utterance(self, kind: str, detail: str, body: dict) -> None:
            # The speaking agent tags its own utterance so it lands in that
            # agent's history — even if a different agent is active by now.
            agent = body.get("agent") or state.active_agent
            if kind == "speak":
                utterance_id = state.create_utterance(
                    "claude", "synthesizing (Grok TTS)…", text=detail, agent=agent
                )
                chars = int(body.get("chars", 0))
                if chars:
                    cost = pricing.tts_cost_usd(chars)
                    state.add_cost("claude", cost)
                    state.update_utterance(utterance_id, cost_usd=cost)
            elif kind == "speak_audio":
                state.update_utterance(
                    state.latest_utterance_id("claude", agent),
                    status="playing through speakers…",
                    detail=detail,
                )
            elif kind == "speak_done":
                state.update_utterance(
                    state.latest_utterance_id("claude", agent), status="played"
                )

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
    host = os.environ.get(BIND_ENV_VAR, "127.0.0.1")
    server = ThreadingHTTPServer((host, port), _handler_class(state))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server
