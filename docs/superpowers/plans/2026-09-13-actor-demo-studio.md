# Actor Demo Studio

Approved design: a standalone /demo-studio/ page shipped in the website build, using the production Companion component. Scripted text is explicitly labeled; there is no hosted transcription dependency.

- [ ] Build a reusable scenario session controller with timestamped user, activity, and agent events. Preserve the existing take JSON event conventions and packaged voice clips.
- [ ] Build actor guidance, rehearsal and browser recording, external-camera synchronization marker, and separate media/timing downloads. Keep original microphone recording free of agent audio; no upload.
- [ ] Add the website entry point, responsive appearance, error recovery and keyboard controls.
- [ ] Verify progression, cancellation, export timing and actual rendered page. Build using the GitHub Pages base path. Commit coherent parts and open the finished Studio.

Recording failures must preserve any captured data. Space only advances while awaiting the actor and never while editing a form. Agent playback must finish before the next actor prompt. Cancelled runs must not resume from outstanding timers. Original media and timing data are separate downloads, using one take name.
