<script setup lang="ts">
/* The crew scene: three agents sharing one companion widget, one voice at
 * a time. Used by BOTH the Storybook story (Synthetic Screenshots/Crew)
 * and the website's crew section, so the two can never drift.
 *
 * The point of the scene is that you can TELL THEM APART. Three
 * conversations hold the rail - a deploy thread, a PR watcher, and the
 * personal assistant - each with its own portrait from voiceSprites, and
 * they take turns: while one holds the floor the others park their
 * messages and the rail shows how many are waiting. Never two speakers lit
 * at once.
 *
 * The widget itself is driven purely through its props - nothing here
 * reaches inside Companion. This component renders the same fixed
 * 1200x760 stage the other marketing scenes use, so a caller can scale it
 * (website/src/scenes/shared.ts useStage) or shoot it at native size.
 *
 * It renders NO buttons. Sound and step-through are affordances of the
 * caller: the story wants BACK/NEXT/RESTART, the website must never show
 * them. Callers drive both through the exposed API below.
 */
import "../../styles/companion-window.css";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import Companion, { type CompanionAgent, type CompanionMessage } from "../Companion.vue";

const props = withDefaults(
  defineProps<{
    /** Push in on the avatar rail at every handover. Off by default: the
     *  moving camera hides how the widget itself behaves. Ignored when the
     *  viewer asks for reduced motion. */
    camera?: boolean;
    compact?: boolean;
    /** Hand the timeline to the caller: the auto-play timer never starts,
     *  so nothing races a click and the loop never restarts on its own. */
    manual?: boolean;
  }>(),
  { camera: false, manual: false },
);

/* ---- the crew --------------------------------------------------------
 *
 * Three voices whose sprite cells sit far apart in the sheet, so the
 * portraits read as three different people rather than three haircuts.
 * luna is the female one and carries the personal reminders.
 */
const CREW = {
  dev: { name: "orderflow-api", voice: "lux" },
  ops: { name: "pull-requests", voice: "rex" },
  assistant: { name: "assistant", voice: "luna" },
} as const;

type CrewId = keyof typeof CREW;
type Speaker = CrewId | "user";

/* ---- the script ------------------------------------------------------
 *
 * One entry per utterance, in the order they are heard. `holder` is who
 * owns the floor while the line plays - a user line belongs to whoever
 * they are answering, so the rail does not flicker mid-exchange.
 * `waiting` is what the other two have parked at that moment, and `zoom`
 * marks the beats where a new agent takes over: those are the ones the
 * camera pushes in on.
 */
interface Beat {
  speaker: Speaker;
  holder: CrewId;
  /** Omitted on camera-only beats, which move the lens and say nothing. */
  text?: string;
  /** The agent's own voice saying `text`, under public/crew-voice. Agent
   *  lines only: in the product you hear the crew, not yourself, so user
   *  beats deliberately have none. */
  clip?: string;
  waiting?: Partial<Record<CrewId, number>>;
  zoom?: boolean;
  hold: number;
}

const SPEAK = 3200;
const REPLY = 4000; // must outlast pre-speech + assembly + silence + awaiting
const HANDOVER = 2600;
/** Camera phases. Each is its own beat so they can be tuned separately and
 *  stepped through one click at a time. The zoom transition itself is
 *  750ms, so PUSH_IN has to outlast it for the move to land before the
 *  agent changes. */
/** Mic open, no words yet - the only moment LISTENING belongs on screen. */
const PRE_SPEECH = 450;
/** The real app waits out a silence threshold (1-4s) before it decides you
 *  have stopped talking. Four is an age on screen; this is the short end of
 *  believable, and it also gives the blinking caret time to be seen. */
const SILENCE = 1500;
/* Swapping one conversation for another without a seam.
 *
 * Two artifacts sit either side of this. Replace the feed in one assignment
 * and Vue's transition-group holds the outgoing bubbles for a frame while
 * the incoming one is already mounted - both threads legible at once.
 * Empty the feed first and it is worse: Companion only suppresses its
 * arrival animation when the incoming feed HAS messages
 * (Companion.vue:266), so an empty feed switches the animation back on AND
 * the widget renders its "NO MESSAGES YET" empty state, which says the new
 * conversation is empty when it is not.
 *
 * So the feed goes straight from one non-empty thread to the next - which
 * is also the case Companion suppresses the animation for - and the single
 * overlap frame is hidden by dipping the thread's opacity across the swap.
 * Only the bubbles dip; the avatar rail, the hero of the handover, never
 * flickers. */
const MASK_OUT = 90; // how long the opacity fade itself takes
/** When to swap. Must clear the fade with margin: the class lands a frame
 *  after we set it, so swapping at exactly MASK_OUT catches the thread
 *  still part-visible and the overlap frame shows through at ~0.25 alpha. */
const SWAP_AT = 190;
const MASK_IN = 90; // let the outgoing bubbles unmount before fading back up
const PUSH_IN = 900;
const PULL_OUT = 1000;
/** Two sentences from the same agent, one after the other - the pause
 *  between them is a breath, not a turn. */
const BREATH = 1500;

const SCRIPT: Beat[] = [
  /* 1. the deploy gate. Four short lines - you should know what is
   *    happening from a glance, without reading. */
  { speaker: "user", holder: "dev", text: "how's staging?", hold: REPLY },
  {
    speaker: "dev",
    holder: "dev",
    text: "Green! Ready to promote.",
    clip: "lux-1.mp3",
    hold: SPEAK,
  },
  { speaker: "user", holder: "dev", text: "do it", waiting: { ops: 1 }, hold: REPLY },
  {
    speaker: "dev",
    holder: "dev",
    text: "on it!",
    clip: "lux-2.mp3",
    waiting: { ops: 1, assistant: 1 },
    hold: SPEAK,
  },

  /* --- handover to ops. Three phases: the lens moves first, THEN the
   *     agent changes under it, and only then do we pull back out. */
  {
    speaker: "dev",
    holder: "dev", // still the deploy thread on screen - nothing has switched yet
    waiting: { ops: 1, assistant: 1 },
    zoom: true,
    hold: PUSH_IN,
  },
  {
    speaker: "ops",
    holder: "ops",
    text: "Last week's PR - finally approved!!!",
    clip: "rex-1.mp3",
    waiting: { assistant: 1 },
    zoom: true, // the switch happens while we are pushed in
    hold: HANDOVER,
  },
  { speaker: "ops", holder: "ops", waiting: { assistant: 1 }, hold: PULL_OUT },

  /* --- handover to the personal one, same three phases. */
  { speaker: "ops", holder: "ops", waiting: { assistant: 1 }, zoom: true, hold: PUSH_IN },
  {
    speaker: "assistant",
    holder: "assistant",
    text: "Alarm went off! It was the courier.",
    clip: "luna-1.mp3",
    zoom: true,
    hold: HANDOVER,
  },
  { speaker: "assistant", holder: "assistant", hold: PULL_OUT },

  /* 3. the personal one waits its turn like everybody else. It does not
   *    just raise an alarm - it worked out what the alarm actually was,
   *    and that it needs nothing from you. That judgment IS the beat. */
  {
    speaker: "assistant",
    holder: "assistant",
    text: "Package is big - probably the printer.",
    clip: "luna-2.mp3",
    hold: SPEAK,
  },
  { speaker: "user", holder: "assistant", text: "thanks", hold: REPLY },
];

/** How many bubbles one conversation may show at once. */
const THREAD_DEPTH = 5;

/* ---- sound ------------------------------------------------------------
 *
 * The clips are the crew's real voices - synthesized through the same
 * xAI/Grok endpoint the daemon speaks with, with the same voice ids
 * (see public/crew-voice/README.md). Served from public/ so they need no
 * bundler asset types.
 *
 * A browser will not let a page make noise before the viewer has clicked
 * something, so the scene is SILENT until the SOUND ON button is pressed
 * and remains a complete scene if it never is: nothing about the timing,
 * the bubbles or the camera depends on audio.
 */
const clips = import.meta.glob<string>("./crew-voice/*.mp3", { eager: true, query: "?url", import: "default" });

/** First beat of the contiguous run that beat `i` belongs to. Each agent
 *  holds the floor for one unbroken stretch of the script, and that
 *  stretch is the whole of its conversation. */
function runStart(i: number): number {
  let start = i;
  while (start > 0 && SCRIPT[start - 1].holder === SCRIPT[i].holder) start -= 1;
  return start;
}

/* ---- the scene -------------------------------------------------------- */

const BACKDROP =
  "radial-gradient(1100px 700px at 25% 15%, #2a2350 0%, transparent 55%)," +
  "radial-gradient(900px 600px at 85% 85%, #1b2a4a 0%, transparent 60%)," +
  "linear-gradient(160deg, #0b0d1f 0%, #141334 55%, #0a0f24 100%)";

/* The slot the widget lives in - the whole reason the frame holds still.
 *
 * Width is this section's own number, a little wider than the product's
 * 420px (CompanionFloat pins the real window at that). What matters is
 * that it is FIXED - left to size itself the widget grows with every
 * longer bubble and the frame breathes through the whole loop.
 * Height is fixed too and the widget is anchored to the BOTTOM of it, the
 * way it sits in the corner of a desktop - the thread then grows upwards
 * from a baseline that never moves, instead of shoving the avatar rail up
 * and down the frame every time a long message lands.
 */
const SLOT = {
  width: "420px",
  height: "400px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
} as const;

/** Reduced motion: the camera is the one thing here that moves for effect
 *  rather than to carry meaning, so it is what gets dropped. */
const reducedMotion = ref(false);
onMounted(() => {
  reducedMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
});

// The widget ships without chrome of its own; transparent mode is how
// it really looks floating over a desktop.
onMounted(() => document.body.classList.add("companion-transparent"));
onUnmounted(() => document.body.classList.remove("companion-transparent"));

/* Story-local stylesheet. The mask has to reach the widget's thread,
 * which no prop exposes - but this styles the scene's own wrapper from
 * the story, it does not touch the component. */
const MASK_CSS = `
  .crew-stage .thread { transition: opacity ${MASK_OUT}ms linear; }
  .crew-stage.masked .thread { opacity: 0; }
`;
onMounted(() => {
  if (document.getElementById("crew-mask-css")) return;
  const el = document.createElement("style");
  el.id = "crew-mask-css";
  el.textContent = MASK_CSS;
  document.head.append(el);
});

const at = ref(0);
let timer: number | undefined;

/** Chained timeouts rather than one interval: every beat sets its own
 *  length, and a handover has to linger longer than a one-word reply.
 *  Never started in manual mode - the buttons are the only clock. */
function schedule() {
  timer = window.setTimeout(() => {
    step(1);
    schedule();
  }, SCRIPT[at.value].hold);
}
onMounted(() => {
  if (!props.manual) schedule();
});
onUnmounted(() => {
  window.clearTimeout(timer);
  stopReveal();
  stopAudio();
});

/** One beat forwards or backwards, wrapping at both ends. The same
 *  move the timer makes, so auto and manual replay the identical
 *  sequence. */
function step(by: number) {
  at.value = (at.value + by + SCRIPT.length) % SCRIPT.length;
}
function restart() {
  window.clearTimeout(timer);
  if (!props.manual) schedule();
  // Re-stage even when we are already sitting on beat 1, otherwise
  // RESTART is a no-op there and the opening utterance never replays.
  at.value = 0;
  stage(0);
}

const beat = computed(() => SCRIPT[at.value]);

/* The thread belongs to ONE conversation. Switching agents switches
 * the whole thread with it - not a single line of the previous
 * conversation stays on screen, exactly as picking another tab in the
 * dashboard would. So a line is shown only if it is part of the run
 * the current beat belongs to.
 *
 * A user line is not in it while it is still being spoken - it lives
 * in the composer until the utterance finishes. */
function said(at: number, upto: number): CompanionMessage[] {
  // The run is decided by the beat we are ON - never by `upto`, which
  // may point one past the end of the run.
  const from = runStart(at);
  return SCRIPT.slice(from, upto)
    .map((b, i) => ({ b, idx: from + i }))
    .filter(({ b }) => !!b.text) // camera-only beats say nothing
    .map(({ b, idx }) => {
    // The id is the beat's own position in the WHOLE script, never its
    // position in this conversation. Companion keys its bubbles by id
    // (Companion.vue: `:key="m.id ?? ..."`), so ids that restarted at
    // zero in every thread made Vue patch the previous conversation's
    // second bubble into this one's second bubble - it visibly morphed
    // across the handover instead of leaving and being replaced.
      return {
        id: idx,
        role: b.speaker === "user" ? ("user" as const) : ("claude" as const),
        text: b.text as string,
        zone: idx === awaiting.value ? ("pending" as const) : ("done" as const),
      };
    });
}

/* Which slice of the script is on screen, held as bounds into SCRIPT
 * rather than as a copied array. */
const bounds = ref({ at: 0, upto: 0 });

/* The AWAITING step of the utterance lifecycle. machines/chat.ts maps
 * the user status `ready` ("AWAITING CLAUDE") onto the pending zone,
 * and Companion renders a pending message in its own style - dashed
 * border, muted text, below the line - which is exactly the "not
 * delivered yet" look. Held briefly so it registers as a flicker
 * rather than a state you have to catch. */
const AWAITING = 320;
const awaiting = ref<number | null>(null);

/** True while a conversation swap is in flight - see MASK_OUT. */
const masked = ref(false);
const feed = computed<CompanionMessage[]>(() =>
  said(bounds.value.at, bounds.value.upto).slice(-THREAD_DEPTH),
);



/* Lit side of the widget, and it is NOT simply "whose beat is this".
 *
 * Companion shows LISTENING when mode is "user" and the composer is
 * empty (Companion.vue:399-400), which is the genuine pre-speech
 * window: the mic is open and nothing has been captured yet. Once
 * words exist that window is over, and once the utterance is committed
 * the user is no longer speaking - the hero scene marks exactly that
 * moment as "idle" (HeroSceneG.vue:80, "not speaking - thinking").
 * Leaving mode at "user" through the settle phase puts LISTENING back
 * on screen at a moment the product never would. */
const mode = ref<"idle" | "user" | "claude">("idle");

/* The user's words ASSEMBLE in the composer the way the real STT
 * pipeline delivers them, and the way the hero scene already shows it
 * (website/src/scenes/HeroSceneG.vue): partial transcripts of one to a
 * few words at speaking pace, chunky and jittered. Per-character
 * typing would read as a terminal rather than as speech. Agent replies
 * are not typed - they arrive whole, because that is how they arrive. */
const liveText = ref("");
const level = ref(0);
let revealTimers: number[] = [];
let levelJitter: number | undefined;

function stopReveal() {
  revealTimers.forEach((t) => window.clearTimeout(t));
  revealTimers = [];
  if (levelJitter) window.clearInterval(levelJitter);
  levelJitter = undefined;
}

/* One <audio> per clip, built on the first click rather than at mount:
 *  the gesture that switches sound on is also what makes the elements
 *  playable, and a scene that is never unmuted fetches nothing. */
const soundOn = ref(false);
const players = new Map<string, HTMLAudioElement>();
let playing: HTMLAudioElement | undefined;

function player(clip: string): HTMLAudioElement {
  let el = players.get(clip);
  if (!el) {
    el = new Audio(clips[`./crew-voice/${clip}`]);
    el.preload = "auto";
    players.set(clip, el);
  }
  return el;
}

/** Cut whatever is mid-sentence and rewind it, so a restart or a step
 *  backwards never leaves a stale voice talking over the new beat. */
function stopAudio() {
  if (!playing) return;
  playing.pause();
  playing.currentTime = 0;
  playing = undefined;
}

/** Say beat `i`'s line, `delay` ms after the bubble is scheduled to
 *  appear - which on a conversation swap is not immediately. The beat
 *  index is re-checked when the timer fires: stepping fast must not let
 *  an earlier line speak over the one now on screen. */
function playBeat(i: number, delay: number) {
  const clip = SCRIPT[i].clip;
  if (!clip || !soundOn.value) return;
  const start = () => {
    if (at.value !== i || !soundOn.value) return;
    const el = player(clip);
    playing = el;
    try {
      el.currentTime = 0;
      void el.play()?.catch(() => {});
    } catch {
      /* Blocked (no gesture yet, the file is missing, or there is no
       * real audio stack under us at all): the scene carries on
       * silently, which is its normal state anyway. */
    }
  };
  if (delay <= 0) start();
  else revealTimers.push(window.setTimeout(start, delay));
}

/** The SOUND ON / SOUND OFF toggle. Switching on speaks the beat we
 *  are already sitting on, so the click has an audible answer instead
 *  of silence until the next line. */
function toggleSound() {
  soundOn.value = !soundOn.value;
  if (!soundOn.value) {
    stopAudio();
    return;
  }
  playBeat(at.value, 0);
}

function speakUser(text: string, index: number) {
  liveText.value = "";
  mode.value = "user"; // mic open, nothing captured yet - LISTENING
  level.value = 0.5;
  levelJitter = window.setInterval(() => (level.value = 0.3 + Math.random() * 0.5), 150);

  const words = text.split(" ");
  let shown = 0;
  const step = () => {
    const chunk = 1 + Math.floor(Math.random() * 3); // 1-3 words per partial
    shown = Math.min(words.length, shown + chunk);
    liveText.value = words.slice(0, shown).join(" ");
    if (shown < words.length) {
      const perWord = 180 + Math.random() * 140; // 180-320ms per word, jittered
      revealTimers.push(window.setTimeout(step, Math.round(perWord * chunk)));
      return;
    }
    // Finished speaking: the utterance drops into the thread.
    // The mic does not close on the last word - it waits out the
    // silence threshold first, composer and caret still on screen.
    revealTimers.push(
      window.setTimeout(() => {
        stopReveal();
        liveText.value = "";
        level.value = 0;
        mode.value = "idle"; // done speaking - NOT listening again
        // Transcribed, and now waiting to be delivered.
        awaiting.value = index;
        bounds.value = { at: index, upto: index + 1 };
        revealTimers.push(
          window.setTimeout(() => (awaiting.value = null), AWAITING),
        );
      }, SILENCE),
    );
  };
  // The mic opens before the first word lands. That gap IS the
  // LISTENING window, and it is the only place it belongs.
  revealTimers.push(window.setTimeout(step, PRE_SPEECH));
}

/* Every beat, auto or hand-driven, is staged the same way - which is
 * what keeps the two stories honest about each other. */
function stage(i: number) {
  stopReveal();
  stopAudio();
  masked.value = false;
  liveText.value = "";
  level.value = 0;
  awaiting.value = null;
  const b = SCRIPT[i];
  if (b.speaker === "user" && b.text) {
    bounds.value = { at: i, upto: i }; // its own line is still in the composer
    speakUser(b.text, i);
  } else {
    mode.value = "claude";
    // In step with the bubble: a run-opening beat swaps the thread at
    // SWAP_AT, so its voice waits for the bubble it belongs to.
    playBeat(i, runStart(i) === i && bounds.value.upto > 0 ? SWAP_AT : 0);
    // A beat that OPENS a run is a conversation switch: mask the
    // thread, swap it whole, unmask. The feed is never empty.
    if (runStart(i) === i && bounds.value.upto > 0) {
      masked.value = true;
      revealTimers.push(
        window.setTimeout(() => {
          bounds.value = { at: i, upto: i + 1 };
          revealTimers.push(
            window.setTimeout(() => (masked.value = false), MASK_IN),
          );
        }, SWAP_AT),
      );
    } else {
      bounds.value = { at: i, upto: i + 1 };
    }
  }
}
watch(at, stage, { immediate: true });

/* The rail: the holder is lit, the other two are dimmed peers carrying
 * whatever they have parked. Exactly one agent is ever active, which is
 * what keeps a single voice on the floor. */
const agents = computed<CompanionAgent[]>(() =>
  (Object.keys(CREW) as CrewId[])
    .map((id) => {
      const waiting = beat.value.waiting?.[id] ?? 0;
      return {
        name: CREW[id].name,
        voice: CREW[id].voice,
        active: id === beat.value.holder,
        unread: waiting > 0,
        waiting,
      };
    }),
);



/* The camera. Handover beats push in on the rail, everything else sits
 * at rest. The origin is the rail's own corner (right rail, near the
 * bottom of the slot, since the widget is anchored there), so the zoom
 * grows out of the faces rather than sliding them off frame. With the
 * camera parked the wrapper still carries the same styles, it just
 * never leaves scale 1.
 *
 * The wrapper is also what PINS THE WIDTH - see SLOT. Constant width,
 * bubbles wrap. */
const cameraStyle = computed(() => ({
  transform: props.camera && !reducedMotion.value && beat.value.zoom ? "scale(2)" : "scale(1)",
  transformOrigin: "94% 100%",
  transition: "transform 0.75s cubic-bezier(0.22, 0.61, 0.36, 1)",
}));

/** "beat 7 / 11" - the number to quote when asking for a beat to go. */
const readout = computed(() => `beat ${at.value + 1} / ${SCRIPT.length}`);

/* The caller owns the chrome - see the file header. */
function previewAgent(index: number) {
  window.clearTimeout(timer);
  soundOn.value = true;
  const target = [1, 5, 8][index] ?? 1;
  if (at.value === target) stage(target);
  else at.value = target;
  if (!props.manual) schedule();
}
defineExpose({ previewAgent, soundOn, toggleSound, step, restart, readout, beats: SCRIPT.length });
</script>

<template>
  <div class="crew-frame" :style="{ background: BACKDROP, width: compact ? '600px' : '760px', height: '440px' }">
    <div class="crew-stage" :class="{ masked }" :style="[cameraStyle, SLOT]">
      <div class="companion-window" inert><div class="companion-host"><Companion
        draggable
        :mode="mode"
        :voice="CREW[beat.holder].voice"
        :feed="feed"
        :live-text="liveText"
        :level="level"
        :agents="agents"
        :max-height="200"
      /></div></div>
    </div>
  </div>
</template>

<style scoped>
/* The same fixed stage the other marketing scenes use. Callers scale it. */
.crew-stage :deep(.companion-header) { visibility: hidden; }
.crew-stage :deep(.companion-window::after) { display: none; }
.crew-frame {
  width: 1200px;
  height: 760px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}
</style>
