# Website: product showcase redesign

## Approved direction

One website, delivered in two reviewable passes: visual redesign and regenerated product screenshots first; sharper messaging and additional selling-point sections second. The user approved the product showcase direction verbally on 2026-09-08. Preserve the Noisy Coding product name.

## Visual design

Use the application's graphite surfaces, warm white text, blue, amber, mint and lavender accents, rounded corners, waveform logo and current voice portraits. Use a system sans-serif for editorial copy and monospace only for commands and technical metadata. Replace the cyan tactical grid, all-caps headings and neon outlines.

The hero pairs a large, short headline with a layered product composition: a current synthetic terminal screenshot and its companion. Use a broad, subtle colored light behind the composition, asymmetric spacing and a small voice-identity strip for personality. Keep screenshots front-facing and legible rather than heavily rotated. Primary action: installation; secondary action: inspect the product demonstration.

Alternate wide screenshot sections with two-column stories and a compact set of feature cards. Avoid a page made entirely of repeated card grids. The dashboard receives a wide dedicated composition; companion examples retain their desktop context. The character section uses the actual CharacterReadout and VoiceAvatar components.

Motion is limited to short entrances and user-triggered demonstrations. No automatic audio. Honor reduced motion and provide a pause control for any continuing animation. All content remains available without animation.

## Page narrative

1. Hero: "Keep the conversation going. Keep your agent working." Supporting copy explains spoken updates and spoken steering. Identify Claude Code support and Codex preview accurately.
2. Show the workflow: agent reports progress, user responds, work continues. Label staged examples as product demonstrations rather than live customer evidence.
3. Companion: stay informed while working elsewhere, with regenerated code-review and refactor scenes.
4. Multiple agents: distinct voices and faces, serialized speech and replay. Do not promise universal interruption behavior beyond documented capabilities.
5. Character: recognizable portraits and adjustable Humor, Honesty, Verbosity, Talkative and Speed. Presets respond to deliberate selection and do not overwrite a visitor's edits automatically.
6. Dashboard: conversation history, replay, microphone controls and visible usage/cost information.
7. Setup: supported installation paths, with Codex explicitly marked preview and links to maintained setup documentation. Do not claim a timed installation guarantee.
8. Practical questions: local application versus external voice processing, API-key requirement and platform availability. Do not imply offline voice processing or call the product free to operate.
9. Final installation action and source link.

The first pass keeps existing useful section content while replacing visual presentation and correcting clearly stale facts. The second pass consolidates repeated feature/crew descriptions into this narrative. Do not introduce pricing, testimonials, adoption numbers or performance claims without evidence.

## Components and assets

Keep Vue/Vite and reuse dashboard components through the existing alias. Separate the page shell, product showcase, character demonstration and setup content by responsibility. Scope marketing styles so they do not change shared application components. Remove the obsolete global avatars.png override; use the current avatar catalog and base-aware Vite asset URLs.

Regenerate the website's imported synthetic PNGs from the current Storybook components. Inspect each rendered image and ensure the output used by the website is actually refreshed: the existing script writes design-concepts/img/generated while the site imports website/src/assets/shots. Record source story, dimensions and capture method. Preserve synthetic screenshots as requested, even where a live component demo accompanies them.

The live microphone/backend demo remains disabled. Do not activate microphone access, autoplay speech or connect visitors to the development daemon. Reuse only isolated fixture-backed product demos.

## Responsive and accessibility behavior

Validate at 1440, 1280, 768 and 390 CSS pixels wide. Stack paired stories on narrow screens. Keep primary actions and copy readable without horizontal scrolling; allow product images to scale and offer a full-size image link when the embedded detail becomes small. Use semantic headings, descriptive screenshot alt text, visible keyboard focus and keyboard-operable demo controls. Decorative light and waveform treatments are hidden from assistive technology.

## Delivery and verification

Branch codex/website-product-showcase is based on origin/v3-desktop, where PR #56 was merged. The main branch predates the redesigned application. Keep the original checkout and unrelated .venv untouched.

Create small coherent commits for the design foundation, refreshed showcase assets and content improvements, each with appropriate checks. Build the website for root and GitHub Pages subpath hosting; verify imported avatars/screenshots load in both. Run dashboard tests if shared integration is affected. Inspect desktop/mobile screenshots, browser errors, navigation, character presets and reduced-motion behavior. No release or deployment is authorized by this design approval.

## Self-review

The plan preserves synthetic screenshots, shares product styling, includes visual flair and separates design from copy refinement. The active implementation branch contains the merged product components. All website claims must be checked against current repository documentation. Native app functionality is outside this website change.
