# Sci-fi HUD Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production Vue 3 rewrite of the grok-voice dashboard in the `design-concepts/scifi-hud.html` style, served at `/next`, with real mic levels over SSE.

**Architecture:** New top-level `dashboard/` (Vue 3 + TS + Vite). State via two composables (`useDaemonState` polling, `useMicStream` SSE); one typed API client; 9 presentational components fed by props only. Daemon gains mic RMS in state, an SSE endpoint, and static serving of the built app. Legacy dashboard at `/` is untouched.

**Tech Stack:** Vue 3.5, TypeScript, Vite 6, Vitest 3 (happy-dom), @vue/test-utils, Storybook 8 (vue3-vite), npm. Python side: existing stdlib daemon + pytest.

**Spec:** `docs/superpowers/specs/2026-07-12-scifi-hud-dashboard-design.md`

## Global Constraints

- Style source of truth: `design-concepts/scifi-hud.html` — same tokens (`--cyan: #3fd8ff`, `--amber: #ffb454`, `--violet: #b98cff`, panel clip-paths, scanlines). THE SAME STYLE, not "inspired by".
- Component discipline: used 3× → component; 2× → judgment; controls are NOT components.
- Bubbles: ONE generic `Bubble`; `UserBubble`/`ClaudeBubble` are thin wrappers (composition).
- Conversation: newest messages at the BOTTOM, auto-scroll to bottom.
- Character panel read-only; voice must update live from daemon polling.
- No Pinia, no Vue Router, no Playwright in v1.
- All fetches live in `dashboard/src/api/client.ts`; components receive props only.
- Python: `.venv/bin/python3 -m pytest -q` stays green (29 tests + new ones).
- Node: v22 present. Package manager: npm. Run all npm commands from `dashboard/`.
- Commits: conventional prefixes, end with the Claude co-author line.

---

### Task 1: Scaffold dashboard/ (Vite + Vue + TS + Vitest + Storybook)

**Files:**
- Create: `dashboard/package.json`, `dashboard/vite.config.ts`, `dashboard/tsconfig.json`, `dashboard/index.html`, `dashboard/src/main.ts`, `dashboard/src/App.vue` (stub), `dashboard/src/styles/hud.css` (tokens only for now), `dashboard/.gitignore`
- Storybook via `npx storybook@latest init --builder vite --no-dev` after Vite works.

**Interfaces:**
- Produces: working `npm run dev` (proxy to daemon), `npm run build` → `dist/`, `npm run test` (vitest), `npm run storybook`.

- [ ] **Step 1: Write config files.** `vite.config.ts` must proxy every daemon path the app uses, so the client can always use relative URLs (same-origin when served at `/next`, proxied in dev):

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const DAEMON = "http://127.0.0.1:8765";
const DAEMON_PATHS = [
  "/status", "/utterances", "/character", "/drain", "/events",
  "/stream", "/pause", "/resume", "/mute", "/mode", "/settings",
  "/voice", "/active-agent",
];

export default defineConfig({
  plugins: [vue()],
  base: "./",           // app is served from /next/ — relative asset URLs
  server: {
    proxy: Object.fromEntries(DAEMON_PATHS.map((p) => [p, DAEMON])),
  },
  test: {
    environment: "happy-dom",
  },
});
```

`package.json` scripts: `dev`, `build` (`vue-tsc -b && vite build`), `test` (`vitest run`), `test:watch`, `storybook`, `build-storybook`.

- [ ] **Step 2: `npm install`, then `npm run dev` and `npm run build` — both succeed.**
- [ ] **Step 3: Storybook init (`npx storybook@latest init --builder vite --no-dev`), trim example stories.**
- [ ] **Step 4: Smoke Vitest** with a trivial `src/__tests__/smoke.spec.ts` asserting `1+1`.
- [ ] **Step 5: Commit** `feat(dashboard): scaffold Vue 3 + TS + Vite + Vitest + Storybook`.

### Task 2: Types + API client

**Files:**
- Create: `dashboard/src/types.ts`, `dashboard/src/api/client.ts`
- Test: `dashboard/src/api/client.spec.ts`

**Interfaces (produces — later tasks rely on these exact names):**

```ts
// types.ts
export interface DaemonStatus {
  listening: boolean; muted: boolean; recording: boolean;
  claude_speaking: boolean; speaking_agents: string[];
  queued: number; session_cost_usd: { user: number; claude: number };
  credits_usd: number | null; mode: "batch" | "live"; tts_mode: "batch" | "live";
  end_silence_ms: number; smart_turn: number; smart_turn_mode: "soft" | "hard";
  language: string; agents: Record<string, number>;
  agent_labels: Record<string, string>; active_agent: string | null;
}
export interface Utterance {
  id: number; role: "user" | "claude"; status: string; text: string;
  detail: string; cost_usd: number; agent: string | null;
  started_at: number; updated_at: number;
}
export interface Character {
  humor: number; honesty: number; brevity: number; chatty: number;
  voice: string; speed: number;
}
```

```ts
// api/client.ts — the ONLY fetch site
export async function getStatus(): Promise<DaemonStatus>
export async function getUtterances(agent?: string): Promise<Utterance[]>
export async function getCharacter(agent?: string): Promise<Character>
export async function setMuted(muted: boolean): Promise<void>
export async function setMode(mode: "batch" | "live"): Promise<void>
export async function setSettings(patch: Partial<{ tts_mode: string; end_silence_ms: number; smart_turn: number; smart_turn_mode: string; language: string }>): Promise<void>
export async function setActiveAgent(name: string): Promise<void>
```

- [ ] **Step 1: failing tests** (global `fetch` mocked with `vi.stubGlobal`): `getStatus` hits `/status` and returns parsed JSON; `getUtterances("x")` hits `/utterances?agent=x`; `setMuted(true)` POSTs `{"muted":true}` to `/mute`.
- [ ] **Step 2: run — FAIL. Step 3: implement client. Step 4: run — PASS. Step 5: commit** `feat(dashboard): typed daemon API client`.

### Task 3: HUD styles + HudPanel

**Files:**
- Create: `dashboard/src/styles/hud.css` (fill), `dashboard/src/components/HudPanel.vue`, `dashboard/src/components/HudPanel.stories.ts`
- Test: `dashboard/src/components/HudPanel.spec.ts`

**Style port:** copy from `design-concepts/scifi-hud.html`: tokens + body background + blueprint grid + scanlines/vignette (lines 11–64), panel + ptitle (134–151). Tokens/global to `hud.css`; panel/ptitle CSS into `HudPanel.vue` scoped styles.

**Interfaces:** `HudPanel` props `{ index: string; title: string }`, default slot. Renders `.panel` with `.ptitle` = `<span class="idx">{{ index }}</span> {{ title }}`.

- [ ] Steps: failing test (renders slot + title/index) → implement → story with sample content → tests pass → commit `feat(dashboard): HUD design tokens and HudPanel frame`.

### Task 4: Bubble + UserBubble + ClaudeBubble

**Files:**
- Create: `dashboard/src/components/Bubble.vue`, `UserBubble.vue`, `ClaudeBubble.vue`, `Bubble.stories.ts`
- Test: `dashboard/src/components/Bubble.spec.ts`

**Style port:** `.msg`/`.mhead`/`.who`/`.st`/`.tm`/`.txt`/`.mfoot`/`.livebars` from prototype lines 177–224.

**Interfaces:**

```ts
// Bubble props (generic)
interface BubbleProps {
  side: "left" | "right";          // claude | you
  accent: "amber" | "violet";      // border/name color
  who: string;                     // "YOU" / "CLAUDE"
  text: string;
  status: string;                  // raw daemon status string
  statusKind: "done" | "work" | "rec" | "spoken";  // visual class
  time: string;                    // "21:47:01"
  cost?: string;                   // "$0.0041" | undefined → "—"
  detail?: string;                 // mfoot left text
  live?: boolean;                  // show livebars EQ (recording)
}
```

`UserBubble`/`ClaudeBubble` accept `{ utterance: Utterance }` and map it to `Bubble` props (side/accent/who fixed; `statusKind` derived from status text: contains "recording"→rec, "playing"/"synthesizing"/"transcribing"/"queued"→work, "played"→spoken, "delivered"/"ready"→done). Mapping function `statusKind(status: string)` exported from `Bubble.vue` for tests.

- [ ] Steps: failing tests (statusKind mapping table; Bubble renders who/text/cost; UserBubble maps a real Utterance fixture) → implement → stories (one per state: recording+livebars, synthesizing pending, played, delivered) → pass → commit `feat(dashboard): generic Bubble with user/claude wrappers`.

### Task 5: ConversationLog

**Files:**
- Create: `dashboard/src/components/ConversationLog.vue`, `ConversationLog.stories.ts`
- Test: `dashboard/src/components/ConversationLog.spec.ts`

**Interfaces:** props `{ utterances: Utterance[] }`. Sorts ascending by `id` (oldest first), renders wrappers by role — **newest ends up at the bottom**. Auto-scrolls its container to bottom on new items (watch + `scrollTop = scrollHeight`).

- [ ] Steps: failing test (given ids [3,1,2] renders order 1,2,3 top→bottom; picks UserBubble vs ClaudeBubble by role) → implement → story with mixed feed → pass → commit `feat(dashboard): ConversationLog, newest at the bottom`.

### Task 6: AgentTabs

**Files:**
- Create: `dashboard/src/components/AgentTabs.vue`, `AgentTabs.stories.ts`
- Test: `dashboard/src/components/AgentTabs.spec.ts`

**Interfaces:** props `{ agents: Record<string, string>; active: string | null; viewed: string | null; speaking: string[] }` (agents = id→label); emits `select(name: string)`. Marks `.live` (active), `.viewing` (viewed), 🔊 when speaking. Hidden when no agents. Styling: HUD chip style (clip-path corners like `.modetoggle`, prototype lines 110–123).

- [ ] Steps: failing test (renders labels; click emits select; speaking icon shows) → implement → story (3 agents, one speaking) → pass → commit `feat(dashboard): AgentTabs`.

### Task 7: CharacterReadout (read-only) + StatusStrip

**Files:**
- Create: `dashboard/src/components/CharacterReadout.vue`, `CharacterReadout.stories.ts`, `dashboard/src/components/StatusStrip.vue`, `StatusStrip.stories.ts`
- Test: `dashboard/src/components/CharacterReadout.spec.ts`, `StatusStrip.spec.ts`

**Style port:** radial gauges (prototype CSS 240–248 + JS gauge builder 632–655 → rewrite as computed SVG in Vue), `.voicecur` (254–262), `.speeddial` (274–277); bigstate ring + costs from header/odometer sections (85–103, 279–301 — odometer simplified to plain glowing total, fuel bar kept).

**Interfaces:**
- `CharacterReadout` props `{ character: Character }` — four gauges (humor/honesty/brevity/chatty), current voice name, speed dial. No inputs, no emits (read-only v1).
- `StatusStrip` props `{ status: DaemonStatus | null; offline: boolean }` — state label logic: offline→`OFFLINE`, muted→`MUTED BY YOU`, !listening→`SPEAKING`, recording→`RECORDING`, else `LISTENING`; exported `stateLabel(status, offline)` for tests; costs `you/claude/total`, credits fuel bar (fraction of $5 prepaid, 20 cells).

- [ ] Steps: failing tests (gauge arc length ∝ value; voice rendered uppercase; stateLabel table) → implement → stories → pass → commit `feat(dashboard): CharacterReadout and StatusStrip`.

### Task 8: Composables (useDaemonState, useMicStream)

**Files:**
- Create: `dashboard/src/composables/useDaemonState.ts`, `useMicStream.ts`
- Test: `dashboard/src/composables/useDaemonState.spec.ts`, `useMicStream.spec.ts`

**Interfaces:**

```ts
export function useDaemonState(pollMs = 400): {
  status: Ref<DaemonStatus | null>;
  utterances: Ref<Utterance[]>;
  character: Ref<Character | null>;
  offline: Ref<boolean>;
  viewedAgent: Ref<string | null>;   // pin logic like legacy: follow active until user clicks
  selectAgent: (name: string) => void; // pins + POST /active-agent
}
export function useMicStream(): { level: Ref<number> }  // 0..1, EventSource /stream/mic, 0 on error/close
```

- [ ] Steps: failing tests (fake timers: poll updates status; fetch reject → offline=true; selectAgent pins viewedAgent; useMicStream: mock EventSource class — message event updates level, error resets to 0) → implement (setInterval in onMounted / clear in onUnmounted; guards for out-of-order responses not needed—sequential await) → pass → commit `feat(dashboard): daemon state polling and mic SSE composables`.

### Task 9: Daemon — mic RMS level in state

**Files:**
- Modify: `src/grok_voice_mcp/listener/state.py` (add `_mic_level`, `set_mic_level`, `mic_level` property), `src/grok_voice_mcp/listener/daemon.py` (audio loop computes RMS per frame)
- Test: `tests/unit/test_listener_state.py`

**Interfaces:** `state.set_mic_level(level: float)` clamps to 0..1; `state.mic_level -> float`; daemon loop: `rms = float(np.sqrt(np.mean((frame / 32768.0) ** 2)))`, scaled `min(1.0, rms * 12)` (voice ≈ 0.2–0.8), set every frame; forced to 0 when `state.paused`.

- [ ] Steps: failing pytest (set/clamp/read; paused daemon loop sets 0 — test the state methods only, loop change reviewed by eye) → implement → `.venv/bin/python3 -m pytest -q` green → commit `feat(daemon): expose real mic RMS level in listener state`.

### Task 10: Daemon — SSE endpoint /stream/mic

**Files:**
- Modify: `src/grok_voice_mcp/listener/http_api.py` (GET `/stream/mic`)
- Test: `tests/unit/test_http_stream.py`

**Interfaces:** `GET /stream/mic` responds `200`, `Content-Type: text/event-stream`, no Content-Length, then every 50 ms writes `data: {"level": <mic_level>, "recording": <bool>}\n\n`, flushes; returns silently on `BrokenPipeError`/`ConnectionResetError`. Loop reads `state.mic_level` — no per-event allocation beyond the f-string.

- [ ] Steps: failing pytest (start real server on port 0 via `start_http_api(state, 0)`… `server.server_address[1]`; raw `http.client` GET, read 2 events, assert format & parsed level) → implement (in `do_GET`, before 404) → green → commit `feat(daemon): SSE mic level stream at /stream/mic`.

### Task 11: Oscilloscope + SpectrumBars

**Files:**
- Create: `dashboard/src/components/Oscilloscope.vue`, `SpectrumBars.vue`, `Oscilloscope.stories.ts`
- Test: `dashboard/src/components/Oscilloscope.spec.ts`

**Interfaces:** both take `{ level: number }` (0..1). Port `drawWave`/`drawSpectrum` math from prototype lines 703–763 INCLUDING the flicker fix (resize backing store only when width changed). Amplitude = prototype envelope × `(0.15 + 0.85 * smoothedLevel)` — silence ≈ flat line, speech breathes. Smoothing: `smoothed += (level - smoothed) * 0.3` per frame. rAF loop in onMounted, cancelled in onUnmounted; respects `prefers-reduced-motion` (draw once).

- [ ] Steps: failing test (mount with level=0 → canvas exists; exported `amplitudeFor(level)` pure fn returns 0.15 at 0, 1.0 at 1) → implement → stories (level knob) → pass → commit `feat(dashboard): oscilloscope and spectrum driven by mic level`.

### Task 12: App.vue — HUD layout + controls wiring

**Files:**
- Modify: `dashboard/src/App.vue`
- Create: `dashboard/src/components/__snapshots__` none — test: `dashboard/src/App.spec.ts` (shallow: renders panels)

**Layout (from prototype):** header (logo + big state + mode toggle + clock), 3 columns: left = Oscilloscope panel `01`, SpectrumBars `02`; center = ConversationLog `04` (+AgentTabs above it); right = CharacterReadout `05`, costs/credits inside StatusStrip panel `06`. Footer: daemon ONLINE/OFFLINE + uptime-ish info we actually have. Controls panel (right column, `07 · CONTROLS`): mute toggle, mode BATCH/LIVE, TTS BATCH/LIVE, end-silence select (0.8/1.5/2/4 s), smart-turn select (off/0.5/0.7/0.9) — plain buttons/selects wired to `api/client.ts`, HUD-styled, NOT components.

- [ ] Steps: assemble; wire composables → props; controls call client fns then rely on next poll (no optimistic state); `npm run build` clean; visual check in dev against daemon; commit `feat(dashboard): assemble HUD layout with live data and controls`.

### Task 13: Daemon serves dist/ at /next

**Files:**
- Modify: `src/grok_voice_mcp/listener/http_api.py`
- Test: `tests/unit/test_http_next.py`

**Interfaces:** `GET /next` → redirect `/next/`; `/next/` → `dashboard/dist/index.html`; `/next/<asset>` → file under `dist/` (path-traversal guarded: resolved path must stay inside dist), content-types: html/js/css/svg/png/woff2; missing dist → 200 HTML "Run: cd dashboard && npm install && npm run build". Dist root resolved from repo layout: `Path(__file__).resolve().parents[3] / "dashboard" / "dist"`.

- [ ] Steps: failing pytest (with tmp dist dir monkeypatched: serves index at /next/, asset with correct type, 404 outside, traversal `..` blocked, helpful page when missing) → implement → green → commit `feat(daemon): serve built HUD at /next`.

### Task 14: End-to-end verification + parity pass

- [ ] `cd dashboard && npm run build`; restart daemon; open `http://127.0.0.1:8765/next/`.
- [ ] Live checks: speak via MCP → Claude bubble appears at BOTTOM with status chain; talk → oscilloscope moves with the voice, flat when silent; mute from UI → daemon /status muted; voice change via change_voice → CharacterReadout updates ≤1 s; two tabs of agents when a second session exists.
- [ ] `npm run test`, `npm run build`, pytest — all green; commit any fixes; final commit `feat: sci-fi HUD dashboard v1 at /next`.

## Self-review notes

- Spec coverage: serving (T13), stack/scaffold (T1), components 9/9 (T3–T7, T11), composables/data flow (T8), daemon RMS+SSE (T9–T10), controls (T12), error handling offline/EventSource (T7 stateLabel + T8), testing per layer (each task), rollout order = task order. Character read-only (T7), newest-at-bottom (T5). ✓
- No placeholders: every task carries concrete signatures, mappings or exact style-source line ranges. ✓
- Type consistency: `Utterance.role` "user"|"claude" matches daemon's `create_utterance` roles; `mic_level` name consistent across T9/T10/T8. ✓
