# Live demo - phase 2 architecture

How the TRY IT LIVE section connects the browser to a real-time Grok (xAI)
voice model. Finalized with the noisy-coding architecture session
(stream-day-4). The phase-1 scripted demo stays forever as the fallback.

## DORMANT for v1 (2026-09-04)

The first public version of the site ships WITHOUT the TRY IT LIVE section.
Nothing was deleted: the section, both drivers, the demo/ folder and
website-backend/ all stay working and in the repo. To bring it back:
1. Flip `TRY_LIVE_ENABLED` to `true` in `website/src/App.vue` (single flag).
2. Run website-backend/ with XAI_DEMO_API_KEY set (see its README).

## Implementation status

Implemented:
- `website-backend/` - the SEPARATE demo-token service (one route,
  POST /api/demo-token; origin allowlist, per-IP + global daily limits,
  kill switch, Turnstile hook stubbed). See its README.
- `useRealtimeDriver.ts` - the realtime driver behind the seam (ephemeral
  token via the backend, WebSocket subprotocol auth, PCM16 both ways,
  partials -> liveText, finalized turns -> feed, audio playback, hard
  session ceiling). Feature-gated: it runs only when the backend grants a
  token; every failure falls back to the scripted driver silently.
- Vite dev proxy `/api` -> the backend port (8788).

DECOMMISSIONED from the flow (2026-09-04, Krzysztof's call): the scripted
fallback. TRY IT LIVE is now LIVE OR NOTHING - START TALKING always attempts
the real session, and any failure (mic denied, backend down/paused,
websocket refused, session dropped) shows a plain "live demo unavailable"
line instead of pre-recorded messages. Nothing a visitor hears is ever
canned, so nobody has to wonder whether it was real. useScriptedDriver.ts,
useDemoVoice.ts, useDemoSpeech.ts and the demo-voice clips stay in the repo
UNWIRED, in case a clearly-labeled public fallback is wanted later.

Still planned:
- Turnstile verification (hook exists, not integrated).
- Prod deploy of the backend + real site origin in the allowlist.
- Server-side persona binding on the mint call once the xAI API supports
  it (today the backend serves the brief and the driver injects it via
  session.update).
- First live test against the real API (needs XAI_DEMO_API_KEY off-stream);
  event names implemented per docs.x.ai and may need touch-up.

## The seam: CompanionDriver

Companion.vue is deliberately dumb - pure props, no data fetching. Today's
glue lives in CompanionFloat/CompanionView (useDaemonState polling +
useMicStream). The conversation frontend must support BOTH backends
cleanly - the existing daemon mode and the new realtime browser mode - so
the seam is a driver contract, types only, in
`dashboard/src/composables/companionDriver.ts`:

```ts
interface CompanionDriver {
  mode: Ref<"idle" | "user" | "claude">;
  feed: Ref<CompanionMessage[]>;
  liveText: Ref<string>;
  level: Ref<number>;
  activity: Ref<string | null>;
  agents: Ref<CompanionAgent[]>; // realtime demo: []
}
```

Anything that can produce these six refs can stand behind the widget.
The phase-1 scripted demo already goes through this seam
(`website/src/demo/useScriptedDriver.ts`), so phase 2 is a driver swap,
not a section rewrite.

## Task 1 - wiring

- Dashboard side: extract the existing CompanionFloat/CompanionView glue
  into `useDaemonDriver()` implementing the interface. Pure refactor, no
  behavior change.
- Website side: implement `useRealtimeDriver()`. It owns the Grok realtime
  session (ephemeral token, WebRTC/WS) and maps events to driver state:
  - partial transcripts -> `liveText`
  - finalized turns -> `feed` entries with monotonic stable ids, zone
    "done" on finalize
  - speaking state -> `mode`
  - mic input level -> `level`
- Do NOT route through machines/chat: those are daemon-pipeline semantics,
  and faking its states would lie to the UI. Map straight to
  CompanionMessage.

## Task 2 - adjustments

Expected near-nil, since Companion is prop-driven. Known items:
- The demo section uses the OPAQUE widget variant. The transparent styles
  key off `body.companion-transparent` (set by the hero scenes for their
  own story); TryLiveSection scope-restores the opaque defaults.

## Cautions (binding)

1. Never import useDaemonState into the website bundle - the site depends
   only on Companion.vue plus the driver interface.
2. Do not set `body.companion-transparent` from the demo section; the hero
   scenes keep transparent, that is their story.
3. PR #47's voice-provider abstraction is Python daemon-side and
   irrelevant here. The only shared concept is voice identity: pick
   voices from voiceSprites.ts names so portraits resolve.

## Backend (small, boring)

1. Visitor clicks START TALKING.
2. Browser asks a small backend endpoint (`POST /api/demo-session`) for an
   ephemeral session token. The xAI API key lives ONLY on that backend -
   it never reaches the client in any form (`XAI_API_KEY` env var on the
   server; nothing committed to the repo).
3. Backend mints a short-lived ephemeral token scoped to the demo model
   and voice, tagged with a hard time and cost budget, and returns it plus
   connection details.
4. useRealtimeDriver opens the realtime connection directly to xAI with
   that token and streams audio both ways.
5. The demo agent's system prompt is `demo-agent-brief.md`, injected
   server-side when the session is minted - the client cannot alter it.
6. One serverless function or tiny node service; no state beyond a rate
   limiter store. Returns 429/503 with a JSON reason when limits are hit
   or the upstream is down.

## Abuse and cost guardrails

- Per-session caps: hard limit ~2-3 minutes of audio and a token budget;
  the server ends the session, the agent is briefed to wrap up gracefully.
- Rate limits: per-IP (e.g. 3 sessions/hour) and a global daily cap
  (circuit breaker) so a viral day cannot burn the budget.
- Ephemeral tokens: single-use, expire in <60s if unused.
- No text input channel in the demo - voice only - which keeps prompt
  injection surface small; the system prompt is server-injected anyway.
- Basic bot friction: mint tokens only from the site origin (CORS +
  origin check); add proof-of-work or Turnstile only if abuse shows up.

## Phase-1 stopgaps (already in the bundle, replaced by phase 2)

- Transcription: `useDemoSpeech.ts` wraps browser SpeechRecognition
  (webkit-prefixed), feature-detected with silent degradation. Interim
  results -> the driver's `liveText`; finalized phrases -> user messages
  via `driver.userSaid()`, which also earns the next scripted beat. This
  is a STOPGAP: Chrome routes the audio through the browser vendor's
  speech service, quality is uneven, Firefox has nothing. Phase 2's Grok
  realtime session transcribes natively (partials -> `liveText` per the
  driver contract above) and replaces this file outright.
- Agent audio: `useDemoVoice.ts` plays pre-generated mp3 clips from
  `src/assets/demo-voice/<key>.mp3` (keys = the line ids the scripted
  driver passes to its `onAgentLine` hook; see the README there). Until
  the clips are generated (fal TTS), lines without a clip fall back to
  browser speechSynthesis - an interim, clearly not the shipped voice.
  Phase 2 streams real model audio and bypasses both paths.
- When SpeechRecognition is listening, its finalized phrases trigger the
  beats and the coarse VAD stands down, so one utterance never earns two
  answers.

## Mic permission UX

- Ask for the mic ONLY after the click on START TALKING, never on load -
  and START TALKING itself IS the mic request: one click spawns the
  widget, speaks the greeting, and calls getUserMedia (the CTA click is
  the user gesture, which also satisfies autoplay policy for the voice).
- While the permission prompt is up, the widget shows a "waiting for your
  mic" state instead of dead silence.
- Permission denied is not an error: fall back to the scripted demo with
  one line ("no mic - here's how a session sounds instead").
- Show a clear ON AIR indicator while the mic is open and a visible way
  to end the session; close the track the moment the session ends.

## Fallback

Any failure - endpoint down, rate limited, token expired, websocket
dropped, no mic, reduced-capability browser - degrades to the scripted
driver, which needs nothing but the bundle. The section never shows a
broken state.
