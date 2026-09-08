# Product screenshots

Regenerated on 2026-09-08 from current Storybook components, using browser screenshots. No painted or invented application UI.

| Asset | Story | Captured frame |
| --- | --- | --- |
| TerminalVoiceFix.png | synthetic-screenshots-companion-over-claude-code--terminal-voice-fix | 1200 × 760 CSS px |
| CodeReviewSpace.png | synthetic-screenshots-companion--widget, backdrop:space;preset:code-review | 612 × 375 CSS px |
| LongRefactorMesh.png | synthetic-screenshots-companion--widget, backdrop:mesh;preset:long-refactor | 612 × 375 CSS px |
| dashboard-content.png | synthetic-screenshots-app--content | 1600 × 1000 CSS px |

PNG resolution reflects the browser's capture scale. Companion/terminal captures are cropped to their rendered story frame. The dashboard story now mounts App.vue with an isolated daemon fixture, so it follows actual product layout changes. The pictured Agents avatar family is a supported product option.

The existing `scripts/marketing-shots.sh` regeneration command copies these four named outputs into this directory after capturing them. Inspect its output before committing: story rendering errors and missing images must not ship. Build the website after regeneration to include the refreshed assets.
