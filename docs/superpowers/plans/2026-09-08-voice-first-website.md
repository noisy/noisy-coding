# Voice-first website implementation

Goal: rebuild the page around audible conversations, retaining the approved Claude Code hero and original Crew script.

Architecture: share the real CompanionCrewScene between Storybook and the site. Package the original recordings as imported assets so deployment subpaths work. The page owns playback controls; the scene owns the scripted timeline. Preserve the original checkout untouched.

- [ ] Restore Crew scene, story and original recordings; verify voice playback and handover with component tests; commit.
- [ ] Replace repeated widget screenshots with the voice demo. Keep human portraits, compact character controls, dashboard replay story and closing slogan. Remove API-key marketing copy while retaining setup links; build and commit.
- [ ] Inspect rendered desktop and mobile page and Storybook. Verify playback is opt-in, recordings resolve, no horizontal overflow, and real widget geometry. Push PR 62.

Do not create a microphone service, regenerate approved dialogue, advertise managed billing, or add another terminal to the hero.
