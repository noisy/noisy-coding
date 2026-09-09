# Demo Studio

Local authoring tool for one continuous webcam/microphone take, live Grok
transcript revisions and the existing Lux/Rex/Luna audio. This is not part of
the deployed website and does not connect to or change the running daemon.

## Run

From the repository root, with the project's Python environment installed:

```sh
PYTHONPATH=src .venv/bin/python tools/demo-recorder/server.py
```

Open **http://127.0.0.1:8790** in Chrome. The server binds only to loopback;
8791 is its websocket bridge. `--port` changes the HTTP port and puts the
websocket on the next port. It uses the same STT credential lookup as the app.
No key is sent to the browser. Camera/microphone access starts only after Record.
Microphone audio goes to the app's Grok STT provider; video stays in browser memory.

## Scenarios

Choose a scenario above the camera. **1 · Meet your crew** keeps the original
Lux/Rex/Luna exchange. **2 · Hero — fix the webhook** follows the hero widget:

1. Listen to Lux: “I'm ready.” / “Your session is running. I'll keep you posted.”
2. Say “What's wrong with the webhook?” and press Space.
3. Lux: “Bad signatures were retried forever. I made them fail fast.”
4. Say “Good. Run the full suite.” and press Space.
5. Lux: “Running - both paths are pinned by the new test.” The take ends.

The camera records the introduction too. Agent playback arrivals and a
`terminal-enter` scene cue are recorded before the first user turn. The JSON
includes the selected scenario snapshot; old JSON without it remains supported.
Hero clips use Grok Lux, English, speed 1.1. They live in this local authoring
tool; the existing website hero stays unchanged until a take is selected.

## Record

1. Wear headphones and use a microphone that does not capture system playback.
2. Click **Record a take**, allow camera/microphone access, and wait for the
   transcription connection and three-second countdown.
3. Say **“how's staging?”**, then press **Space**. Listen to Lux.
4. Say **“do it”**, then press Space. Listen to Lux, Rex and Luna in sequence.
5. Say **“thanks”**, then press Space. The tool waits for the final transcript
   and stops automatically. The entire exchange is one video with microphone
   audio; agent clips are separate, not mixed into that recording.
6. Review with the video controls. The preview adds agent audio using the
   recorded playback events. Negative offsets show a turn's text earlier;
   positive offsets delay it. Nothing else moves. Offsets are in milliseconds.
7. Download **both** the video and JSON. Keep them together. To revise a saved
   take, choose both files with **Reopen a take** and export a new timing JSON.

Keep the tab visible while recording. **Stop & keep take** salvages an interrupted
take; an interrupted STT session may not have its final revision. A transcription
or playback error is displayed rather than silently fabricating scripted text.
Recordings are held in memory until downloaded, not automatically persisted.
Closing/crashing the browser before downloading can lose a take.

## Timing contract

`events` is the unmodified arrival journal. `atMs` uses `performance.now()`
relative to the MediaRecorder `start` event. This is browser-observed timing,
not a claim of sample-accurate physical microphone/camera synchronization.
Camera and microphone share a MediaRecorder stream; event delivery, hardware
output latency and the initial recorder event can have small offsets.

- `transcript` records **every** partial/final browser arrival and its utterance
  ID, including revisions arriving after the agent starts speaking.
- `user-end` records Space; `agent-start`/`agent-end` record actual media
  playback events. `agent-switch` and camera cues are independent records.
- `transcriptOffsetsMs` is a signed per-utterance display adjustment.
- `presentation` is a derived sorted event list with `displayAtMs`; only
  transcript entries change time, clamped to their user turn's beginning.
- Raw events and all non-transcript times remain unchanged when offsets change.

The recording scenario is an authoring snapshot of `CompanionCrewScene.vue`.
It reuses that component's five audio assets, with manually directed turns and
actual clip durations rather than the website's fixed demo timers. This tool
previews transcripts and video, not the production companion. Rendering a
chosen take in the website's real component is the next integration step.

## Check

```sh
PYTHONPATH=src .venv/bin/python -m pytest tools/demo-recorder/test_server.py -q
node --test tools/demo-recorder/*.test.mjs
```

Tests replace recording/STT browser APIs and the provider at their boundaries.
They verify a continuous three-turn/five-reply recording, arrival identity,
cleanup, error redaction, transcript-only offsets and seeking agent intervals.
A live hardware/provider take still needs a deliberate recording by the user.
