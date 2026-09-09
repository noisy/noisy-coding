# Recorded crew — take V1

User-provided continuous recording from 2026-09-09. The website and Storybook
use `RecordedCrewScene.vue`: a real Companion driven by this video's current
time and the exported transcript/event journal.

`crew-v1.mp4` preserves the full 1280×720 frame and complete recording duration.
The five existing crew clips are mixed at their recorded `agent-start` times;
the microphone track is retained. H.264/AAC and faststart allow browser playback
and seeking without separate audio clocks.

The camera crop is now applied at rendering time. Storybook's **Camera zoom**
slider runs from 1× (full frame) to 4× (central 25%), in steps of 0.05×.
The default 2× displays the central 50% in each dimension. Adjusting zoom neither
restarts the media nor changes the overlay's size or bottom-left position.

`crew-v1.json` preserves every raw event and the exported transcript offsets
(currently none). Changing transcript offsets affects only widget text.

To regenerate from the original folder:

```sh
python3 tools/demo-recorder/prepare_take.py /path/to/nagranie-v1 dashboard/src/components/marketing/recorded-crew
```

The webcam overlay is anchored to the **screenshot's** bottom-left corner,
outside the widget's zoom transform. Its 16:9 shape preserves the source aspect ratio. Audio starts muted; mouse hover
or keyboard focus requests sound, and leaving mutes it. If browser autoplay
policy blocks sound, the explicit sound button remains available.
