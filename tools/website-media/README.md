# Website delivery assets

Keep originals. These are derived exports, not replacements for source recordings
or artwork. Run from the repository root with Python 3, FFmpeg/ffprobe and cwebp:

```sh
python3 tools/website-media/generate.py
```

The script reads the approved full-size mixed MP4 masters and original PNGs. It
never uses a previously optimized output as input. Raw microphone/camera originals
remain in `tools/demo-recorder/takes/hero-v1/original.webm` and
`tools/demo-recorder/takes/crew-v5/original.webm`. To reconstruct the approved mixes
from those raw originals, follow `tools/demo-recorder/takes/README.md` first, then
run this script. This additional delivery encoding is lossy video; audio is copied
without re-encoding, and there are no cuts or timing edits.

- Images: WebP quality 90, unchanged dimensions and sprite coordinates.
- Video: 854×480 H.264, CRF 24, slow preset, original cadence, MP4 faststart.
- Audio: packet-identical AAC stream copy from the approved mixed master.
- Output paths are fixed separately from input paths. Temporary files are checked
  before replacing delivery outputs. Never overwrite or delete an original.

`manifest.json` records original and raw archive SHA-256 hashes, generated asset
hashes, file sizes and tool versions. Generation checks input hashes before/after,
video duration, frame counts and audio packet hashes. Tool upgrades can change
encoded output bytes; inspect quality again after regenerating.

The website passes optimized MP4 URLs to the real shared scene components.
Storybook's ordinary recording stories keep the 720p master by default for crop
adjustment; full website stories use the website exports. The shared portrait
catalog uses the full-dimension WebP so the embedded dashboard benefits too.

## Revert

Restore the previous image references in `dashboard/src/avatars/catalog.ts` and
`dashboard/src/components/marketing/RecordedHeroScene.vue`. Remove the website
recording overrides from `website/src/scenes/HeroSceneG.vue` and
`website/src/CrewSection.vue`; the shared components then use their retained full
masters. No source restoration, audio reconstruction or re-recording is needed.

## Current delivery sizes

| Asset | Original master | Website derivative |
| --- | ---: | ---: |
| Portrait sheet | 1,732,042 bytes | 443,724 bytes |
| Wallpaper | 1,863,342 bytes | 260,182 bytes |
| Hero recording | 9,370,294 bytes | 3,944,386 bytes |
| Crew recording | 3,105,721 bytes | 1,306,355 bytes |

Combined: 16,071,399 → 5,954,647 bytes (62.9% smaller). This is full asset size,
not a claim about first-load traffic, LCP or measured page speed. Original masters
may still appear in the build because shared default props reference them; only
the website's selected delivery URLs are rendered. A later artifact-cleanup task
can separate their build graphs without removing the originals from the repo.
