# Demo Studio presentation timing editor

**Goal:** Shorten the visible speaking state of each user turn and fill its remaining pause with Thinking, a matching console activity, or no status. Never change media timing.

**Architecture:** Typed presentation overrides derive a view of the immutable recorder timeline. The real RecordedHeroScene accepts overrides and manual playback controls. A local-only Vue editor uses that scene, a shared timeline, exact end-time inputs, status selection, audition and separate JSON import/export. Demo Studio links to its Vite preview; it is excluded from the website production build.

- [x] Add and test presentation validation, derived user-end events and activity windows.
- [x] Extend shared player controls and hero console milestones to preview overrides.
- [x] Build local editor, persist browser drafts, support source-bound JSON and add Demo Studio navigation.
- [x] Verify browser interactions and tests, document workflow, commit and push.
