# demo-voice clips

Pre-generated TTS clips for the TRY IT LIVE demo agent. Drop mp3s here and
`useDemoVoice.ts` picks them up automatically (import.meta.glob); any line
without a clip falls back to browser speechSynthesis (interim only).

Generate with a fal TTS model (recommend_model "text to speech", pick a
pleasant conversational voice), one clip per line, filenames = keys below.
Line texts live in `src/demo/useScriptedDriver.ts` (GREETING, BEATS, SCRIPT).

- greet.mp3 - spawn greeting
- beat-1.mp3, beat-2.mp3, beat-3.mp3 - answers after the visitor speaks
- script-1.mp3, script-3.mp3, script-4.mp3, script-6.mp3 - the agent lines
  of the canned fallback conversation (indices are 1-based positions in
  SCRIPT; user lines 2 and 5 need no clip)

Keep clips small (mono, ~48-64 kbps) - they ship in the site bundle.
