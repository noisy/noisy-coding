<script setup lang="ts">
/** Always-on-top companion (#28) - PoC, Storybook only.
 *
 * Layout locked with Krzysztof (2026-08-22, v4):
 *  - two persistent rails: the user's hexagon on the LEFT, the head on
 *    the RIGHT - always visible, they light up when their side talks;
 *  - between them one scrollable thread (user amber/left, claude
 *    violet/right, shared compact Bubble), freshest at the bottom,
 *    clipped by PIXEL height and auto-scrolled to the newest message;
 *  - cold start: the daemon seeds the feed with an "I'm ready." from
 *    Claude, so the widget never shows an empty stage.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Bubble from "./Bubble.vue";
import { voiceSpriteStyle } from "./voiceSprites";

export interface CompanionMessage {
  role: "user" | "claude";
  text: string;
  /** The utterance's own id. Keying by position makes Vue reuse a bubble
   *  for a different message - switch conversation and the second bubble
   *  morphs into the other agent's second bubble instead of being replaced. */
  id?: string | number;
}

/** One conversation in the rail, in the dashboard's own tab order. */
export interface CompanionAgent {
  name: string;
  voice: string;
  /** The conversation currently on screen: bigger, lit, never dimmed. */
  active?: boolean;
  /** Something happened here while you were looking elsewhere. */
  unread?: boolean;
}

const props = withDefaults(
  defineProps<{
    mode?: "claude" | "user" | "idle";
    voice?: string;
    /** Mixed feed, oldest first; freshest renders at the bottom. */
    feed?: CompanionMessage[];
    /** Live transcript while the user talks (grows as they speak). */
    liveText?: string;
    /** Pixel height of the visible thread; older messages scroll away. */
    maxHeight?: number;
    /** Live mic level, 0..1. Drives the spectrum. */
    level?: number;
    /** Other conversations, oldest at the top. The ACTIVE one is `voice`. */
    agents?: CompanionAgent[];
  }>(),
  {
    mode: "idle",
    voice: "rex",
    feed: () => [],
    liveText: "",
    maxHeight: 200,
    level: 0,
    agents: () => [],
  },
);

const portrait = computed(() => {
  const style = voiceSpriteStyle(props.voice);
  if (!style) return {};
  // No mirror in the companion - the head faces the way the artwork does.
  const { transform: _drop, ...rest } = style;
  return rest;
});
/* The spectrum is never dead.
 *
 * A row of flat bars reads as "broken", not "quiet", so silence gets a slow
 * breathing motion and the mic level rides on top of it. Each bar has its
 * own phase and its own weight, so the shape stays uneven the way a real
 * spectrum does - a symmetrical wave looks like a screensaver.
 *
 * Driven by rAF rather than CSS: the bars have to follow a value that
 * changes, and a keyframe animation cannot.
 */
const BAR_COUNT = 7;
const BAR_PHASE = [0, 1.9, 3.4, 0.7, 2.6, 4.3, 1.2];
const BAR_WEIGHT = [0.55, 0.95, 0.7, 1, 0.78, 0.9, 0.6];
const IDLE_FLOOR = 7;   // bar height at rest, in viewBox units
const IDLE_SWING = 3.5; // how far the breathing moves it
const PEAK = 46;        // height at full level

/* Each message carries its own size, decided by its own length and never
 * revisited. A short line gets big type, a long one gets small type, and
 * neither changes afterwards - no measuring, no re-fitting, no flicker.
 *
 * Thresholds are in characters, which is a coarse proxy for how much room
 * the text needs. It does not have to be exact: being one size out on a
 * borderline message is invisible, while a message that resizes after you
 * have started reading it is not.
 */
function sizeOf(text: string): string {
  const n = text.trim().length;
  if (n <= 90) return "size-l";
  if (n <= 260) return "size-m";
  return "size-s";
}

const grownHeight = ref(0);

/* How much room the thread is allowed: never more than the window can show.
 * The floating window is resized by hand and remembers its last size, so the
 * requested height is a wish, not a fact - a widget that insists on 220px
 * inside a 160px window puts its newest line out of reach. */
const ceiling = ref(Number.POSITIVE_INFINITY);
const threadHeight = computed(() =>
  Math.min(Math.max(props.maxHeight, grownHeight.value), ceiling.value),
);


/** Keep the thread inside the window it is in. Type size is not its job. */
async function refit() {
  const el = scroller.value;
  const box = root.value;
  if (!el || !box) return;

  // Measure the window the widget is ACTUALLY IN - once it floats, that is
  // the picture-in-picture window, not the page that owns this code.
  const view = box.ownerDocument.defaultView ?? window;
  const chrome = box.offsetHeight - el.offsetHeight;
  ceiling.value = Math.max(110, view.innerHeight - chrome - 4);

  const room = Math.min(props.maxHeight, ceiling.value);
  const content = el.scrollHeight;
  // A tall conversation may earn more room, but never more than the window
  // can show: a thread taller than its window cannot be scrolled to, and the
  // newest line would be stranded below the edge.
  grownHeight.value =
    content > room ? Math.min(content, props.maxHeight * 2.5, ceiling.value) : 0;
  await nextTick();
}

/* The stack of heads is absolutely positioned (it floats over the thread,
 * clear of the scrollbar), so it contributes nothing to the widget's
 * height. Reserve that height explicitly, or an empty conversation
 * collapses the thread and the heads hang off the bottom edge. */
const railHeight = computed(() =>
  Math.max(52, props.agents.length * 40 + 24) + 32,
);

const emit = defineEmits<{ (e: "select", name: string): void }>();
void emit;

function otherStyle(voice: string) {
  const style = voiceSpriteStyle(voice);
  if (!style) return {};
  const { transform: _drop, ...rest } = style;
  return rest;
}

const bars = ref<number[]>(new Array(BAR_COUNT).fill(IDLE_FLOOR));
// Smoothed level: the raw feed is jumpy at 20fps, and bars that snap look
// like noise. Attack fast so speech feels immediate, release slow so the
// spectrum falls away instead of collapsing.
const smoothed = ref(0);
let frame = 0;

function animate(now: number) {
  const target = Math.max(0, Math.min(1, props.level));
  const k = target > smoothed.value ? 0.35 : 0.08;
  smoothed.value += (target - smoothed.value) * k;

  const t = now / 1000;
  bars.value = BAR_PHASE.map((phase, i) => {
    const breath = Math.sin(t * 1.6 + phase) * IDLE_SWING;
    const voice = smoothed.value * PEAK * BAR_WEIGHT[i];
    // Flicker keeps the peaks from moving as one block while speaking.
    const flicker = smoothed.value * Math.sin(t * 11 + phase * 2.3) * 6;
    return Math.max(2, IDLE_FLOOR + breath + voice + flicker);
  });
  frame = requestAnimationFrame(animate);
}

let sizeWatch: ResizeObserver | undefined;

onMounted(() => {
  frame = requestAnimationFrame(animate);
  // A ResizeObserver rather than a window listener: it fires when the widget
  // is dragged into the floating window and when that window is resized,
  // both of which change the space available - and neither of which raises a
  // resize event on the page that owns this code.
  if (root.value) {
    sizeWatch = new ResizeObserver(() => void refit());
    sizeWatch.observe(root.value);
  }
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  sizeWatch?.disconnect();
});

/* A wide invisible "grab zone" along the right edge: the hairline thumb
 * grows to full size when the pointer is within GRAB_ZONE_PX of the edge,
 * not just on the 6px bar itself (too thin to target). */
const GRAB_ZONE_PX = 44;
const nearScroll = ref(false);
function trackPointer(e: MouseEvent): void {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
  nearScroll.value = box.right - e.clientX <= GRAB_ZONE_PX;
}

/* The arrival animation is for ONE new message sliding in. Switching
 * conversation replaces every bubble at once, and animating all of them
 * together reads as the whole panel shaking before it settles. So: animate
 * an arrival, never a replacement. */
const animateArrival = ref(true);
let lastIds: string[] = [];
let primed = false;

watch(
  () => props.feed.map((m) => String(m.id ?? "")).join("|"),
  (joined) => {
    const ids = joined ? joined.split("|") : [];
    const shared = ids.some((id) => id && lastIds.includes(id));
    // Nothing in common with what was on screen = a different conversation.
    /* "Replaced" cannot be judged by what we came FROM.
     *
     * The previous version required the old feed to be non-empty, so
     * leaving an empty conversation looked like a first render and skipped
     * the hide - which is why switching back from a thread with no messages
     * showed the type resizing, while every other switch did not. What
     * matters is that the arriving messages share nothing with the ones on
     * screen, however few of those there were. */
    const replaced = primed && !shared && ids.length > 0;
    animateArrival.value = !replaced;
    lastIds = ids;
    primed = true;
  },
  { immediate: true },
);

const scroller = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);
/* Follow the newest message, unless the reader has scrolled away.
 *
 * The live transcript updates several times a second while the user talks,
 * and every update used to yank the thread back down - so reading anything
 * older was impossible. Standard chat behaviour: stay pinned while you are
 * at the bottom, stop following the moment you scroll up, resume when you
 * come back down.
 */
const BOTTOM_SLACK_PX = 48;
const following = ref(true);

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  following.value = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK_PX;
}

async function stickToBottom(smooth = true): Promise<void> {
  await nextTick();
  const el = scroller.value;
  if (!el || !following.value) return;
  // Two frames: the first lands after Vue patches the DOM, the second after
  // the browser has laid it out. Scrolling in between aims at a height that
  // is about to change, which is how the newest message kept ending up just
  // below the edge.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

/* ONE watcher, in order: fit first, then scroll.
 *
 * There used to be two on the same signals - one scrolling, one re-fitting.
 * The scroll started against the old layout, then the re-fit changed the
 * type size and the height underneath it, and a smooth scroll aimed at a
 * scrollHeight that no longer existed stopped short of the newest message.
 * Fitting has to finish before anything decides where the bottom is.
 */
watch(
  () => [props.feed.length, props.liveText, props.maxHeight],
  async () => {
    await refit();
    // Jump, do not glide: after a re-fit the layout has already moved, and a
    // smooth scroll would animate from a position that is no longer real.
    await stickToBottom(false);
  },
  { immediate: true },
);
</script>

<template>
  <div ref="root" class="companion" :style="{ minHeight: railHeight + 'px' }" @mousemove="trackPointer" @mouseleave="nearScroll = false">
    <!-- Left rail: the user's indicator. Lights up while they talk. -->
    <div class="rail left" :class="{ active: mode === 'user' }">
      <svg viewBox="0 0 100 100" class="hex">
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27"
          fill="none" stroke="currentColor" stroke-width="5" />
        <!-- Always drawn: silence is a slow breath, speech rides on top. -->
        <g class="spectrum">
          <rect v-for="(h, i) in bars" :key="i"
            :x="26 + i * 7.5" :y="50 - h / 2" width="4.5" :height="h"
            rx="2" />
        </g>
      </svg>
    </div>

    <!-- The thread: pixel-clamped, scrollable, pinned to the newest. -->
    <div ref="scroller" class="thread" @scroll.passive="onScroll" :class="{ nearscroll: nearScroll }" :style="{ maxHeight: threadHeight + 'px' }">
      <transition-group
        :name="animateArrival ? 'arrive' : ''"
        tag="div"
        class="msgs"
      >
        <Bubble
          v-for="(m, i) in feed"
          :key="m.id ?? `pos-${i}`"
          :class="[sizeOf(m.text), { older: i < feed.length - 1 || !!liveText }]"
          compact
          :side="m.role === 'claude' ? 'right' : 'left'"
          :accent="m.role === 'claude' ? 'violet' : 'amber'"
          who="" status-kind="off" status-label="" time=""
          :text="m.text"
        />
      </transition-group>
      <Bubble
        v-if="mode === 'user' && liveText"
        class="livebubble"
        :class="sizeOf(liveText)"
        compact live
        side="left"
        accent="amber"
        who="" status-kind="rec" status-label="" time=""
        :text="liveText"
      />
      <span v-else-if="mode === 'user'" class="listening">LISTENING</span>
      <span v-else-if="!feed.length && !liveText" class="listening">NO MESSAGES YET</span>
    </div>

    <!-- Claude's head floats over the thread's bottom-right corner so the
         scrollbar can live at the widget's true right edge. -->
    <div class="rail right" :class="{ active: mode === 'claude' }">
      <!-- Every conversation, in the dashboard's tab order. Nothing moves
           when you switch: the selected one grows and lights up in place. -->
      <button
        v-for="a in agents"
        :key="a.name"
        class="head"
        :class="{ other: !a.active, current: a.active, unread: a.unread }"
        :style="otherStyle(a.voice)"
        :title="a.name"
        @click="$emit('select', a.name)"
      />
      <!-- No agent list (Storybook, single conversation): just the portrait. -->
      <span v-if="!agents.length" class="head current" :style="portrait" />
    </div>
  </div>
</template>

<style scoped>
.companion {
  width: 420px;
  background: rgba(5, 14, 24, 0.92);
  border: 1px solid rgba(63, 216, 255, 0.25);
  border-radius: 14px;
  padding: 16px 4px 16px 16px; /* thread + scrollbar run to the right edge */
  font-family: var(--mono);
  display: flex; gap: 14px; align-items: flex-end;
  position: relative;
}

/* --- rails: always there, dim until their side holds the floor ---------- */
/* Dimming means "not talking right now" - it must not dim the whole rail
   any more, because the rail now also carries the other conversations, and
   the ACTIVE portrait has to stay legible whether or not it is speaking.
   So dim the elements, not the container. */
.rail { flex: none; }
.rail .hex { opacity: 0.45; transition: opacity 0.3s ease; }
.rail.active .hex { opacity: 1; }
/* the head sits ON TOP of the thread, clear of the edge scrollbar */
.rail.right { position: absolute; right: 22px; bottom: 16px; z-index: 1; }

.hex { width: 52px; height: 52px; color: var(--amber); display: block; }
.rail.active .hex { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--amber) 70%, transparent)); }
/* Heights come from the mic level frame by frame - a keyframe animation
   would fight the script for the same property. Dimmed at rest so the idle
   breathing reads as "listening" rather than "something is happening". */
.hex .spectrum rect {
  fill: var(--amber);
  opacity: 0.45;
  transition: opacity 180ms ease;
}
.rail.active .spectrum rect { opacity: 1; }

/* The stack of other conversations, climbing away from the active one. */
.rail.right { display: flex; flex-direction: column; align-items: center; gap: 6px; }
/* Two sizes, not a gradient: the conversation you are in, and every other
   one. A ladder of shrinking heads implied an order that does not exist -
   the other agents are peers, none is further away than another. */
/* Two sizes, one order. The rail is the dashboard's tab strip turned
   vertical: positions never change, so switching cannot shuffle anything -
   the selected head simply grows and lights up where it already was. */
.head.current {
  width: 52px; height: 52px;
  opacity: 1;
  border-color: var(--violet);
  box-shadow: 0 0 10px color-mix(in srgb, var(--violet) 45%, transparent);
}
.head.other {
  width: 34px; height: 34px;
  padding: 0;
  opacity: 0.55;
  border-color: rgba(148, 163, 220, 0.4);
  cursor: pointer;
  transition: opacity 140ms ease, transform 140ms ease, border-color 140ms ease;
}
.head.other:hover { opacity: 1 !important; transform: scale(1.08); border-color: var(--violet); }
/* A dot, not a badge: at 30px there is no room for a number, and the point
   is only "something happened here". */
.head.other.unread { box-shadow: 0 0 0 2px var(--amber); }

.head {
  display: block; width: 44px; height: 44px;
  border: 2px solid var(--violet);
  border-radius: 50%;
}
.rail.active .head {
  box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 60%, transparent);
  animation: head-bob 1.6s ease-in-out infinite;
}
@keyframes head-bob { 50% { translate: 0 -2px; } }

/* --- the thread ------------------------------------------------------------ */
.thread {
  flex: 1; min-width: 0;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
  /* bubbles keep clear of the floating head and the edge scrollbar */
  padding-right: 70px;
  /* NOTE: no scrollbar-width/scrollbar-color here - when set, Chrome
     switches to native scrollbars and IGNORES the ::-webkit-scrollbar
     hairline below. Webkit styles alone cover our Chrome-based use. */
  /* older messages melt away at the top edge */
  mask-image: linear-gradient(to bottom, transparent, black 22px);
}
/* Constant 6px gutter so nothing ever reflows; the thumb is DRAWN as a
   hairline (transparent border + padding-box clip) and fills the gutter
   only when the pointer is actually on the scrollbar - grab-ready, but
   invisible-ish for the scroll-wheel case. */
.thread::-webkit-scrollbar { width: 6px; }
.thread::-webkit-scrollbar-track { background: transparent; }
.thread::-webkit-scrollbar-thumb {
  background: rgba(63, 216, 255, 0.2);
  background-clip: padding-box;
  border-left: 4.5px solid transparent;
  border-radius: 3px;
}
.thread.nearscroll::-webkit-scrollbar-thumb,
.thread::-webkit-scrollbar-thumb:active {
  border-left-width: 0;
  background: rgba(63, 216, 255, 0.5);
}
.msgs { display: flex; flex-direction: column; gap: 12px; }
.msgs .older { opacity: 0.55; }
/* Denser type, companion only.
 *
 * The widget is a glance at a corner of the screen, not a reading surface -
 * at the dashboard's size a couple of sentences fill it and the thread turns
 * into a scrollbar. Smaller text and tighter bubbles buy roughly twice the
 * history in the same pixels. Scoped to .companion so the same Bubble stays
 * full size everywhere else. */
/* NOTE: target .msg, not .msg.compact. Bubble takes `compact` as a PROP and
   uses it for v-if only - it never puts the class on the element, so every
   `.msg.compact` rule (including Bubble's own) matches nothing. Cost me a
   round of "the font is not changing" on stream. */
/* Per-message sizing. A short line is meant to be read at a glance from
   the corner of the eye; a long one has to fit, and you will look at it
   properly anyway. */
.thread :deep(.size-l) { padding: 8px 12px; }
.thread :deep(.size-l .txt) { font-size: 14px; line-height: 1.45; }

.thread :deep(.size-m) { padding: 6px 10px; }
.thread :deep(.size-m .txt) { font-size: 11.5px; line-height: 1.4; }

.thread :deep(.size-s) { padding: 5px 9px; }
.thread :deep(.size-s .txt) { font-size: 9.5px; line-height: 1.32; }
.thread :deep(.size-s .who) { font-size: 8px; letter-spacing: 0.16em; }

.msgs :deep(.msg.side-right), .thread :deep(.msg.side-right) { align-self: flex-end; }
.msgs :deep(.msg.side-left), .thread :deep(.msg.side-left) { align-self: flex-start; }

.arrive-enter-active { transition: all 0.35s ease; }
.arrive-enter-from { opacity: 0; transform: translateY(14px); }
.arrive-move { transition: transform 0.35s ease; }

.livebubble { flex: none; align-self: flex-start; }
.listening {
  flex: none;
  font-size: 10px; letter-spacing: 0.34em; color: var(--amber);
  text-shadow: var(--glow-amber);
  animation: fade 1.4s ease-in-out infinite;
}
@keyframes fade { 50% { opacity: 0.45; } }
</style>
