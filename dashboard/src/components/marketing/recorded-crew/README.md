# Recorded crew — take V1

User-provided continuous recording from 2026-09-09. The website and Storybook
use `RecordedCrewScene.vue`: a real Companion driven by this video's current
time and the exported transcript/event journal.

`crew-v1.mp4` contains the central 50% of the original width and height:
1280×720 → 640×360, crop origin (320, 180). It retains the complete recording
duration. The five existing crew clips are mixed at their recorded
`agent-start` times; the microphone track is retained. H.264/AAC and faststart
allow browser playback and seeking without separate audio clocks.

`crew-v1.json` preserves every raw event and the exported transcript offsets
(currently none). Changing transcript offsets affects only widget text.

To regenerate from the original folder:

```sh
python3 tools/demo-recorder/prepare_take.py /path/to/nagranie-v1 dashboard/src/components/marketing/recorded-crew
```

The webcam overlay is anchored to the **screenshot's** bottom-left corner,
outside the widget's zoom transform. Its 16:9 shape preserves the requested
50%-by-50% crop without cutting it again to force a square.
