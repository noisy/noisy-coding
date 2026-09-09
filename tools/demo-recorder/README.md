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

### Hero: search and deployment

**3 · Hero — fix search and deploy** is the longer hands-free take: report
broken partial search, ask for case-insensitive matches, request tests, deploy
to production, then say thanks. The complete approved dialogue is shown in the
scenario selector. Five prerecorded Lux clips accompany five user turns.
A short pause separates “On it” from the production confirmation; its actual
playback timing is captured like every other reply. No real deployment runs.

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

## Audio cleanup markers

Open `/audio-editor` (or Audio cleanup in Demo Studio). Load the **original**
camera/microphone file, before mixing agent audio. No upload or microphone
permission is involved. The browser decodes a waveform and fingerprints the
original file; it never writes to or re-encodes it.

Drag on the waveform, zoom up to 30×, or set Start/End in whole milliseconds.
I/O mark boundaries at the playhead, P auditions the selection, and Space
plays/pauses when focus is outside a form control or native video player.
Loop selection repeats the original interval. Add each unwanted sound as a
repair interval; choose a separate clean background interval as room tone.
It must not overlap repairs. Clean background means recorded room sound without
speech, breaths or clicks, not generated white noise. Wave height changes only
the visualization, not playback volume.

Save markers JSON and keep it with the source. Reopen the original first,
then its JSON; mismatched source fingerprints are rejected. Draft markers
are also stored locally in the browser, when storage is available. This page
does not apply repair or denoising: the exported intervals are input for a
later, reversible cleanup pass. Preview stopping uses browser playback timing;
the exported millisecond boundaries are the authoritative edit coordinates.

## Presentation timing editor

Open **Presentation timing** from Demo Studio, or
`http://127.0.0.1:5201/timing-editor.html`. This local-only Vue page requires the
website preview (`npm --prefix website run dev -- --port 5201`) so it can render
the real hero components. It is not a production-build entry and is not deployed.

Select a user turn, move its speaking-end slider or enter whole milliseconds,
and choose None, Thinking, or Console activity. The original speaking window
stays faintly visible on the timeline. Console activity is matched to that turn
(read, edit, tests, production deployment); results retain their original reply
timing. The final thank-you has no following reply and cannot receive work status.

Play the whole scene or audition one turn with its reply. Clicking a Work or Lux
segment seeks to its start. The JSON contains only presentation overrides and the
original source fingerprint, not edited media or shifted transcript timestamps.
Save `hero-v1.presentation-edits.json` beside the original recording and provide
it for integration into the published scene. Until that step, changes apply only
to this local preview. Drafts are retained locally in the browser; reopening an
export validates that it belongs to the same original take.
