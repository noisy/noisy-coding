# Demo Studio Audio Editor Implementation Plan

**Goal:** Mark multiple microphone repair intervals and one clean room-tone reference with millisecond boundaries, without modifying source media.

**Architecture:** A separate local browser page loads a user-selected original recording. Native video playback provides the master clock, a decoded waveform supports selection, and a validated JSON edit decision list preserves source identity and timing. No recording, upload, denoising, or destructive processing is performed by this page.

**Tech Stack:** Vanilla browser JavaScript, Canvas, Web Audio, existing loopback Python server, Node tests.

- [x] Add pure range/document validation and tests for invalid ranges, source identity, overlapping repairs and room-tone conflicts.
- [x] Add editor page with video, zoomable waveform, draggable selection, exact start/end inputs, mark-at-playhead controls, selected-range audition, repair list and room-tone selection.
- [x] Add JSON export/reopen, unsaved-change protection, waveform loading/error states, local navigation and documentation.
- [x] Verify browser rendering and interaction using the original hero V1 file, run appropriate checks, commit and push.

Room tone is recorded ambient sound, not generated white noise. Export its interval separately for replacement and possible later noise profiling. All intervals refer to the original recording clock; edits never shorten the recording. Preserve source filename, size and SHA-256 and validate them on reopening. Do not change the live voice daemon or the source recording.
