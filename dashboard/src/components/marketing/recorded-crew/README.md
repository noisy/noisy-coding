# Recorded crew — take V5

User-provided continuous recording from 2026-09-09. The website and Storybook
use `RecordedCrewScene.vue`: a real Companion driven by this video's current
time and the exported transcript/event journal.

`crew-recording.mp4` preserves the full 1280×720 frame and complete recording duration.
The five existing crew clips are mixed at their recorded `agent-start` times;
the microphone track is retained. H.264/AAC and faststart allow browser playback
and seeking without separate audio clocks.

The camera crop is now applied at rendering time. Storybook's **Camera zoom**
slider runs from 1× (full frame) to 4× (central 25%), in steps of 0.05×.
The default 1.35× displays approximately 74% in each dimension, with both offsets set to zero. Adjusting zoom neither
restarts the media nor changes the overlay's size or top-left position.
**Camera offset X** and **Camera offset Y** move the image within that window.
Zero centers each axis; negative moves left/up, positive moves right/down.
The range −100…100 spans the available image overflow at the selected zoom,
so the crop never exposes empty edges. At 1× the whole frame fits, so offsets
have no effect until zoom is increased.

`crew-recording.json` preserves retained event times and exported transcript offsets (currently none).
The intermediate camera-reset (sequence 24) and camera-zoom (sequence 25)
are omitted to hold the widget zoom continuously through the Rex-to-Luna handover.
Approved V5 transcript corrections are applied from `transcript-corrections.json`;
corrected events retain the original recognition in `originalText`. The source
recording and timing file remain untouched.

To regenerate from the original folder:

```sh
.venv/bin/python tools/demo-recorder/prepare_take.py tools/demo-recorder/takes/crew-v5 dashboard/src/components/marketing/recorded-crew
```

After regeneration, remove camera events with sequences 24 and 25 from
`crew-recording.json` to retain the continuous handover zoom.

The webcam overlay is anchored to the **screenshot's** top-left corner,
outside the widget's zoom transform. Its 16:9 shape preserves the source aspect ratio. Audio starts muted. A prominent translucent speaker button sits at the screenshot’s bottom-left
corner, separate from the webcam. It toggles sound for the entire recording
and remains visible in both muted and audible states. Mouse hover does not
change audio. The external sound button can mute it again. Leaving the viewport
still pauses and mutes the recording.

The website's second section enables `playbackControls`: it waits for the
centered Play button, which starts or resumes with sound enabled. The sound
toggle is shown only during playback. Pause appears on hover or keyboard
focus, and stays visible on touch devices. Pausing or ending restores Play.
This mode replaces the external conversation button on the website.

The original microphone/video and raw timeline are versioned under
`tools/demo-recorder/takes/crew-v5`. See `tools/demo-recorder/takes/README.md`
for the complete reproducible processing recipe.
