# Demo session recorder

## Accepted design

A disposable local recording tool captures one continuous camera/microphone
video while streaming the same microphone to the product's Grok STT session.
Every interim/final transcript is stored with its browser arrival time and
utterance identity. Space ends a user turn and plays the existing crew clips
through headphones. Playback and camera cues are logged independently.

The video is the master clock. A signed transcript offset changes only display
times, never the raw events, video, microphone audio, agent audio or turn order.
Late final revisions belong to the original utterance. No recording is started
automatically and no running daemon settings are changed.

## Implementation plan

- [x] Add a loopback-only static server and websocket bridge using
  `StreamingSession`; reuse its provider authentication and PCM handling.
  Serve only recorder files and the existing five crew clips. Test the bridge
  with a fake streaming provider, including late final text and disconnects.
- [x] Add camera/microphone capture, audio-worklet PCM forwarding, scripted
  headphone playback controlled by Space, raw event journal and downloadable
  video/JSON. Use MediaRecorder start as the session origin; log audio `playing`
  and `ended` events rather than estimating durations.
- [x] Add video-clock review with signed transcript-only offset and exports.
  Test that offsets preserve raw events and agent timing, and that late updates
  retain their original utterance identity.
- [x] Run offline tests, inspect the rendered local UI, document launch and
  recording steps, and commit each completed boundary. Real camera/mic and
  paid STT verification requires the user's deliberate Record click.

## Scope

English crew scenario: "how's staging?", "do it", "thanks". The second
response includes the existing Lux/Rex/Luna handovers. This is an authoring
tool, not a shipped website route. Website integration of the resulting take
is subsequent work once a recording is chosen.
