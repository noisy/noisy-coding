/** Chat-window lifecycles as explicit state machines.
 *
 * The daemon narrates each utterance through free-form status strings and
 * the UI used to interpret them with substring checks scattered across
 * components. These machines are the single source of truth instead: which
 * lifecycle states exist, which events are legal in each, and how the raw
 * status strings map onto them. Paste a machine's config into stately.ai
 * to see the graph.
 *
 * The daemon stays string-based — statusToState/stateToStatus bridge the
 * two worlds. statusAllows answers "is this action legal right now" for UI
 * affordances (cancel, replay) and the /debug event injector; a transition
 * that no event chain explains (validStatusChange) means the daemon and
 * this model disagree — exactly the assumption bug we want surfaced.
 */

import { createMachine, transition } from "xstate";

export type Role = "user" | "claude";

export const USER_EVENTS = [
  "TRANSCRIBE", // segment closed (batch) or a live partial arrived
  "READY", // final transcript queued for pickup
  "DELIVER", // a hook drained it into Claude's context
  "CANCEL", // user recalled it before pickup
  "EMPTY", // transcription came back without speech
  "DROP", // too short / mic changed / daemon restarted mid-flight
  "STT_ERROR",
] as const;

export const CLAUDE_EVENTS = [
  "HOLD", // user is speaking — playback waits for their turn to end
  "SYNTHESIZE", // TTS rendering started (also re-entry on replay/catch-up)
  "PLAY", // first audio reached the speakers
  "PLAYED", // playback finished — or the user hit stop
  "UNHEARD", // parked: voice muted, or daemon restarted mid-flight
  "TTS_ERROR",
] as const;

export type UserEvent = (typeof USER_EVENTS)[number];
export type ClaudeEvent = (typeof CLAUDE_EVENTS)[number];

export type UserState =
  | "recording"
  | "transcribing"
  | "ready"
  | "delivered"
  | "empty"
  | "dropped"
  | "error"
  | "cancelled";

export type ClaudeState =
  | "queued"
  | "holding"
  | "synthesizing"
  | "playing"
  | "played"
  | "unheard"
  | "error";

export const userUtteranceMachine = createMachine({
  id: "user-utterance",
  initial: "recording",
  states: {
    recording: {
      on: {
        TRANSCRIBE: "transcribing",
        READY: "ready", // live STT can finalize without a partial ever showing
        EMPTY: "empty",
        DROP: "dropped",
      },
    },
    transcribing: {
      on: {
        TRANSCRIBE: "transcribing", // next live partial
        READY: "ready",
        EMPTY: "empty",
        DROP: "dropped",
        STT_ERROR: "error",
      },
    },
    ready: {
      on: {
        DELIVER: "delivered",
        CANCEL: "cancelled", // recall is legal ONLY while awaiting pickup
      },
    },
    delivered: { type: "final" },
    empty: { type: "final" },
    dropped: { type: "final" },
    error: { type: "final" },
    cancelled: { type: "final" },
  },
});

export const claudeUtteranceMachine = createMachine({
  id: "claude-utterance",
  initial: "queued",
  states: {
    queued: {
      on: { HOLD: "holding", SYNTHESIZE: "synthesizing", UNHEARD: "unheard" },
    },
    holding: {
      on: { SYNTHESIZE: "synthesizing", UNHEARD: "unheard" },
    },
    synthesizing: {
      on: { PLAY: "playing", TTS_ERROR: "error", UNHEARD: "unheard" },
    },
    playing: {
      on: { PLAYED: "played", TTS_ERROR: "error", UNHEARD: "unheard" },
    },
    // Replay adopts the ORIGINAL card and runs it through the pipeline
    // again — including the mute park and the wait-for-user-turn hold.
    played: {
      on: { SYNTHESIZE: "synthesizing", HOLD: "holding", UNHEARD: "unheard" },
    },
    unheard: {
      on: { SYNTHESIZE: "synthesizing", HOLD: "holding" },
    },
    error: { type: "final" },
  },
});

// --- status-string bridge ---------------------------------------------------
// The daemon's exact status vocabulary, matched by prefix so wording
// suffixes ("dropped — too short" vs "dropped — mic changed") stay free.

const USER_STATUS_PREFIXES: Array<[string, UserState]> = [
  ["recording", "recording"],
  ["transcribing", "transcribing"],
  ["ready", "ready"],
  ["delivered", "delivered"],
  ["empty", "empty"],
  ["dropped", "dropped"],
  ["transcription error", "error"],
  ["cancelled", "cancelled"],
];

const CLAUDE_STATUS_PREFIXES: Array<[string, ClaudeState]> = [
  ["queued — waiting", "holding"], // must precede the bare "queued" prefix
  ["queued", "queued"],
  ["synthesizing", "synthesizing"],
  ["playing", "playing"],
  ["played", "played"],
  ["unheard", "unheard"],
  ["error", "error"],
];

/** Map a raw daemon status onto a machine state; null = unknown status
 * (a daemon status this model has never heard of — worth logging). */
export function statusToState(role: Role, status: string): string | null {
  const table = role === "user" ? USER_STATUS_PREFIXES : CLAUDE_STATUS_PREFIXES;
  const s = status.toLowerCase();
  const hit = table.find(([prefix]) => s.startsWith(prefix));
  return hit ? hit[1] : null;
}

const USER_CANONICAL_STATUS: Record<UserState, string> = {
  recording: "recording…",
  transcribing: "transcribing (live)…",
  ready: "ready — awaiting pickup",
  delivered: "delivered to Claude",
  empty: "empty — no speech",
  dropped: "dropped — too short",
  error: "transcription error",
  cancelled: "cancelled by you",
};

const CLAUDE_CANONICAL_STATUS: Record<ClaudeState, string> = {
  queued: "queued",
  holding: "queued — waiting for you to finish",
  synthesizing: "synthesizing (Grok TTS)…",
  playing: "playing through speakers…",
  played: "played",
  unheard: "unheard — voice muted",
  error: "error",
};

/** The canonical daemon wording for a state — what the sandbox writes onto
 * cards so they look exactly like the real thing. */
export function stateToStatus(role: Role, state: string): string {
  return role === "user"
    ? USER_CANONICAL_STATUS[state as UserState]
    : CLAUDE_CANONICAL_STATUS[state as ClaudeState];
}

// --- machine queries ----------------------------------------------------------

function machineFor(role: Role) {
  return role === "user" ? userUtteranceMachine : claudeUtteranceMachine;
}

function snapshotAt(role: Role, state: string) {
  return machineFor(role).resolveState({ value: state });
}

export function canFire(role: Role, state: string, event: string): boolean {
  try {
    return snapshotAt(role, state).can({ type: event });
  } catch {
    return false; // unknown state value
  }
}

/** The state `event` leads to, or null when it is illegal here. */
export function nextState(role: Role, state: string, event: string): string | null {
  if (!canFire(role, state, event)) return null;
  const [next] = transition(machineFor(role), snapshotAt(role, state), { type: event });
  return String(next.value);
}

export function legalEvents(role: Role, state: string): string[] {
  const events: readonly string[] = role === "user" ? USER_EVENTS : CLAUDE_EVENTS;
  return events.filter((event) => canFire(role, state, event));
}

/** Convenience for UI affordances: is `event` legal for a card currently
 * showing `status`? Unknown statuses allow nothing. */
export function statusAllows(role: Role, status: string, event: string): boolean {
  const state = statusToState(role, status);
  return state !== null && canFire(role, state, event);
}

/** Reachable in one or more hops. The dashboard POLLS the daemon, so a
 * fast card can skip states between two snapshots (queued → [synthesizing
 * missed] → playing) — a legal change is a PATH, not a single edge. */
export function reachable(role: Role, fromState: string, toState: string): boolean {
  const seen = new Set([fromState]);
  const queue = [fromState];
  while (queue.length) {
    const state = queue.shift()!;
    for (const event of legalEvents(role, state)) {
      const next = nextState(role, state, event)!;
      if (next === toState) return true;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** Whether an observed status change fits the model. Same-state rewording
 * (a longer live partial, a detail refresh) is always fine. */
export function validStatusChange(role: Role, fromStatus: string, toStatus: string): boolean {
  const from = statusToState(role, fromStatus);
  const to = statusToState(role, toStatus);
  if (from === null || to === null) return false;
  return from === to || reachable(role, from, to);
}

// --- cross-machine invariants -------------------------------------------------

/** The daemon has ONE playback worker: it takes the OLDEST queued card and
 * walks it through these states before touching the next. At any moment at
 * most one claude card may sit in a worker state — and lifecycle events
 * always land on the FIFO head, never on the newest arrival. */
export const CLAUDE_WORKER_STATES: ReadonlySet<string> = new Set([
  "holding",
  "synthesizing",
  "playing",
]);

/** Transcripts reach Claude only through HOOKS, and hooks run only between
 * tools or at turn end: PostToolUse flips the activity line to THINKING…
 * before draining, Stop clears it before draining. While a concrete tool
 * line is showing, the tool is still executing and nothing can deliver.
 * (Delivery DURING busy is by design — that's mid-work voice steering.) */
export function canDeliverDuring(activityLine: string | null): boolean {
  return activityLine === null || activityLine === "THINKING…";
}

export type TimelineZone = "done" | "active" | "pending";

/** The chat window's virtual "processed line" (Krzysztof's model): the
 * timeline reads past → present → future, top to bottom. Above the line
 * only things that already HAPPENED (delivered to Claude, played to the
 * user, parked, failed); ON the line the present (the busy row, and any
 * card mid-synthesis/mid-playback just above it); below it only things
 * still WAITING their turn (transcripts awaiting pickup, replies queued
 * behind the speaker). */
export function timelineZone(role: Role, status: string): TimelineZone {
  const state = statusToState(role, status);
  if (role === "user") {
    // recording/transcribing never ask (they live in the composer slot);
    // unknown statuses render as settled history rather than jumping zones.
    return state === "ready" ? "pending" : "done";
  }
  if (state === "queued" || state === "holding") return "pending";
  if (state === "synthesizing" || state === "playing") return "active";
  return "done";
}
