# Sci-fi HUD dashboard — Vue 3 rewrite (design)

Date: 2026-07-12 · Status: approved by Krzysztof

## Goal

Rewrite the grok-voice dashboard as a production-quality Vue app in the
visual style of the `design-concepts/scifi-hud.html` prototype ("Iron Man
HUD"). Not a prototype: componentized, typed, tested, with Storybook as the
component workbench. The legacy dashboard stays available until the new one
reaches parity.

## Decisions (agreed)

- **Serving:** legacy dashboard stays at `/` untouched; the new app is served
  by the daemon at `/next` from `dashboard/dist/`. When parity is reached,
  the two swap (`/` ↔ `/legacy`). Development uses the Vite dev server with a
  proxy to the daemon API.
- **Stack:** Vue 3.5 + TypeScript + Vite, in a new top-level `dashboard/`
  directory. State via composables — no Pinia, no router (single-screen app;
  add them only when a real need appears).
- **Audio realism:** the daemon streams the real microphone level (RMS 0–1)
  over **SSE** (`GET /stream/mic`, ~20 Hz). One long-lived HTTP connection —
  no request spam, no WebSocket dependency (data flows one way; stdlib
  `ThreadingHTTPServer` handles SSE with a thread per connection;
  `EventSource` auto-reconnects). The oscilloscope waveform stays synthetic
  but its amplitude is driven by the real level: silence = flat line.
  The same channel can later carry full waveform/spectrum frames.
- **Conversation order:** newest messages at the BOTTOM (chat-like) —
  reversed vs the legacy dashboard.
- **Character panel: read-only** in v1 (voice interface makes sliders
  redundant — Krzysztof asks aloud for changes). The displayed voice must
  update live (daemon owns the character). Interactive editing may return
  later.
- **Component discipline** (Krzysztof's rule): used in 3 places → component;
  2 places → judgment call; no premature extraction. Bubbles are ONE generic
  `Bubble` component with thin user/Claude wrappers via composition, not
  inheritance.

## v1 parity scope

1. Conversation bubbles with lifecycle statuses (newest at bottom).
2. Oscilloscope + spectrum bars on real RMS.
3. Agent tabs (switch/pin, 🔊 while speaking).
4. Character read-out (read-only, live voice).
5. System status: listening/recording/speaking chip, session costs, credits.
6. Controls actually used: mute, mode batch/live, TTS mode, end-silence,
   smart-turn.

## Architecture

```
dashboard/
  src/
    components/      # the 9 components below
    composables/     # useDaemonState, useMicStream
    api/client.ts    # typed daemon API client (the only fetch site)
    types.ts         # Status, Utterance, Character types
    App.vue          # HUD grid layout; controls live here inline
  .storybook/
  dist/              # build output, served at /next
```

### Components (9, each justified)

| Component | Why it exists |
|---|---|
| `HudPanel` | corner-decorated frame + `01 · TITLE` header — used ~6× |
| `Bubble` | generic speech bubble: content, status, timestamp, cost |
| `UserBubble` / `ClaudeBubble` | thin wrappers composing `Bubble` (side, color, icon) |
| `ConversationLog` | bubble list, newest at bottom, auto-scroll |
| `Oscilloscope` | canvas waveform modulated by real RMS |
| `SpectrumBars` | canvas bars modulated by RMS |
| `AgentTabs` | agent tabs + pinning + speaking icon |
| `CharacterReadout` | read-only character display, live voice |
| `StatusStrip` | state chip, costs, credits |

Controls (mute/mode/TTS/silence/smart-turn) are plain elements in one
`App.vue` panel — NOT components until a third use appears.

### Data flow

- `useDaemonState` — polls `/status` + `/utterances` every 400 ms (same
  cadence as legacy).
- `useMicStream` — `EventSource` on `/stream/mic`.
- Actions (mute, mode, …) go through `api/client.ts` POSTs.
- Components receive everything via props — zero fetching inside components,
  so Storybook feeds them mock data with no plumbing.

## Daemon changes (3, small)

1. Audio loop computes frame RMS → `state.set_mic_level(float)`; decays to 0
   when paused/muted (a muted mic must read as "not listening").
2. `GET /stream/mic` — SSE endpoint, `data: {"level": 0.42}\n\n` every
   ~50 ms; silent cleanup on disconnect.
3. `GET /next/*` — static serving of `dashboard/dist/` with correct
   content-types; friendly "run npm build" page when dist is missing.

## Testing

- **Vitest + Testing Library:** composables (mocked fetch / EventSource) and
  behavioral components (`Bubble` statuses, `ConversationLog` ordering and
  auto-scroll, `AgentTabs` pinning).
- **Storybook (vue3-vite):** a story per component with mock data — the
  design-discussion workbench; interaction stories where useful.
- **pytest:** RMS in state + SSE frame format.
- **Playwright:** explicitly later, not in v1.

## Error handling

Daemon down → `useDaemonState` flips to `offline` (StatusStrip chip, like
legacy "daemon not responding"); `EventSource` reconnects on its own; the
oscilloscope flattens to a line when the stream is silent — an honest "not
listening" signal.

## Rollout order

1. Scaffold (Vite + TS + Storybook + Vitest) with CI-able npm scripts.
2. Presentational components (bubbles, panels) in Storybook.
3. Composables + typed client on real daemon data.
4. Canvases + daemon RMS/SSE changes.
5. Controls panel.
6. Parity check → swap `/` ↔ `/legacy`.

## Out of scope (deliberate)

Pinia, Vue Router, Playwright, interactive character sliders, mobile view
rewrite (`mobile.py` untouched), full-waveform streaming (architecture
allows it later via the same SSE channel).
