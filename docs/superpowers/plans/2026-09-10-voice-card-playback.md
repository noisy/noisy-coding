# Voice card playback implementation plan

**Goal:** Apply the approved website interaction: click a voice card to play or stop its sample at 1.2× speed.

**Architecture:** Keep playback in `website/src/VoiceCarousel.vue`, using its existing cancellation and single-sample handling. Use native buttons for card activation by pointer and keyboard.

**Tech stack:** Vue 3, TypeScript, HTML audio, Vite.

## Approved design

The whole card replaces the separate Listen button. The active card has a highlighted border and Playing label. Clicking it again stops playback; choosing another card stops the previous sample. Samples play at 1.2× with browser-default pitch preservation. Existing error handling and unmount cleanup remain. Cards without recordings are disabled.

## Implementation and validation

- [x] Set `audio.playbackRate = SAMPLE_PLAYBACK_RATE`, with the constant set to `1.2`.
- [x] Replace the article and nested Listen button with one native card button carrying the existing accessible label and pressed state.
- [x] Add playing, hover, focus-visible, and disabled styles.
- [x] Run `npm run build` from `website/` and `git diff --check`.
- [x] Check playback toggling and keyboard activation in a browser.
- [x] Commit the completed change locally.
