# Recording sources and rebuild recipe

These are source assets for the marketing demos, not files served by the local
recorder or copied wholesale into the Pages build. Keep them in Git: never replace
an original with an edited, cropped or mixed export.

| Take | Website scene | Source |
| --- | --- | --- |
| `hero-v1` | Hero: search fix and production deployment | `hero-v1/original.webm` |
| `crew-v5` | Second section: Lux, Rex and Luna | `crew-v5/original.webm` |

Each folder contains:

- `original.webm`: byte-identical camera + microphone recording, **without agent audio**.
- `timeline.json`: untouched recorder export, including agent-start timestamps and raw transcript revisions.
- `transcript-corrections.json`: approved presentation-only replacements. Rebuilt events retain `originalText`.
- `manifest.json`: original filename and SHA-256 fingerprints of archived inputs.
- `audio-edits.json` (hero only): the user's six repair intervals and clean room-tone reference. Its fingerprint matches the renamed original by content, not filename.

## Rebuild from a clean checkout

Use the project's Python environment (`numpy` is declared in `pyproject.toml`)
and put `ffmpeg` and `ffprobe` on PATH. Run from the repository root:

```sh
.venv/bin/python tools/demo-recorder/prepare_take.py tools/demo-recorder/takes/hero-v1 dashboard/src/components/marketing/recorded-hero
.venv/bin/python tools/demo-recorder/prepare_take.py tools/demo-recorder/takes/crew-v5 dashboard/src/components/marketing/recorded-crew
```

The script automatically picks `timeline.json`, `transcript-corrections.json`
and, when present, `audio-edits.json`. Extra JSON files in the source folder do
not confuse timeline discovery. An audio-edits fingerprint mismatch aborts.

Agent assets are already versioned and are never generated again during rebuild:
hero clips live under `tools/demo-recorder/clips/hero-lux-search-*.mp3`; the crew
clips live under `dashboard/src/components/marketing/crew-voice/`. In particular,
the hero uses `hero-lux-search-production.mp3`, not the earlier staging reply.
The exact clip names and their start times come from `timeline.json`.

## What audio cleanup does

Decode the **original microphone** to float PCM at its native sample rate and
channel count. Replace only marked intervals with the selected room tone, looping
that reference if necessary. Use 12 ms crossfades at interval edges and loop seams.
Keep the same sample count. Outside the marked intervals PCM samples remain
unchanged. No global denoising, gating, normalization or time compression is used.

Then mix the untouched agent clips at their original `agent-start` times. Encode
the final video as H.264 CRF 23 / yuv420p and audio as AAC 128 kbps with faststart.
This final lossy encoding is separate from the sample-preserving repair step.
The camera image stays full-frame; crop, placement and zoom are Vue/Storybook
settings. Transcript adjustments never change media or agent timing.

For an A/B export with the original microphone and the same agent timing:

```sh
.venv/bin/python tools/demo-recorder/prepare_take.py tools/demo-recorder/takes/hero-v1 /tmp/hero-uncleaned --skip-audio-repair
```

To revise marks, open `original.webm` and `audio-edits.json` in Demo Studio's
`/audio-editor`. Save the new JSON, review its diff, and rebuild. To create a new
take, make a new folder and retain its original and recorder JSON. Keep the
previous source folder; do not overwrite it with a new recording.

Different FFmpeg versions may produce different encoded bytes, but timing,
source assets and processing parameters are fully specified here.
