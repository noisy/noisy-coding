# Noisy Coding interface redesign

The user delegated the visual design and requested uninterrupted implementation and testing. The prepared worktree remains on `feat/interface-redesign` at base `890dfc6`. Storybook on port 6007 was opened and actual companion and dashboard screenshots inspected before styling began.

## Direction

Use a graphite desktop workspace: neutral surfaces, off-white text, restrained blue selection, warm user speech, and subtle violet agent identity. System sans text at readable sizes replaces terminal typography. Monospace is reserved for numeric telemetry and code. Remove clipped corners, neon, scanlines, and ornamental framing. Ship one coherent dark theme.

The dashboard prioritizes its conversation. A compact header identifies the app and exposes global playback. A 248px audio sidebar keeps mute prominent and groups controls; a quieter voice inspector provides conversation-specific voice and character controls. Scopes become small functional meters. Narrow windows scroll and reflow without hiding controls.

The companion is a self-contained rounded panel with a readable session/status header, text thread, microphone indicator, and accessible session buttons. Preserve identity artwork, pending statuses, speech roles, scroll following, native drag regions, and transparent-window support. Empty, working, recording, speaking, queued, muted and offline states must have textual distinctions.

## Constraints and verification

Keep existing props, events, API contracts and routing. Do not touch other worktrees or the running daemon. Use isolated Storybook data for control testing. Keep website consumers building. No new dependencies. Preserve reduced motion and visible keyboard focus.

Verify component tests, dashboard typecheck/build, Storybook build, affected website/desktop consumers, and rendered desktop/narrow/companion views. Add interaction regression tests only for meaningful changed behavior. Record actual results and remaining limitations.
