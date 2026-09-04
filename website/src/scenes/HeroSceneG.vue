<script setup lang="ts">
/** Variant G - widget-first landing:
 *  the companion appears alone, center stage, slightly larger than life and
 *  already alive (spectrum + first words) -> the dimmed terminal rises in
 *  underneath -> the widget settles down onto it, shrinking to its docked
 *  bottom-right size -> a short voice-driven exchange plays -> reset, loop.
 */
import { onMounted, ref } from "vue";
import ClaudeCodeMock from "@dashboard/components/marketing/ClaudeCodeMock.vue";
import Companion, { type CompanionMessage } from "@dashboard/components/Companion.vue";
import { AGENTS, FULL_FEED, prefersReducedMotion, useStage, useTimeline } from "./shared";
import macDesktop from "../assets/mac-desktop.png";

const { frame, scale } = useStage();
const { at, clear } = useTimeline();

const widgetIn = ref(false);
const aloft = ref(true); // big + center stage until it lands on the terminal
const terminalIn = ref(false);
const visibleLines = ref(0);
const feed = ref<CompanionMessage[]>([]);
const liveText = ref("");
const level = ref(0);
const mode = ref<"idle" | "user" | "claude">("idle");
const activity = ref<string | null>(null);
const faded = ref(false);

let jitter: number | undefined;
let revealTimers: number[] = [];
let currentUtterance = "";

/** The user's words ASSEMBLE in the live bubble the way the real STT
 *  pipeline delivers them: partial transcripts of one to a few words at
 *  speaking pace (chunky, jittered - per-character typing would read as a
 *  terminal, not speech). `revise` optionally mis-hears one word and
 *  corrects it on the next partial, the way a streaming model fixes its
 *  guess mid-utterance - used once per loop, sparingly. */
function startTalking(text: string, revise?: { wordIndex: number; misheard: string }) {
  mode.value = "user";
  liveText.value = "";
  currentUtterance = text;
  level.value = 0.5;
  jitter = window.setInterval(() => (level.value = 0.3 + Math.random() * 0.5), 150);

  const words = text.split(" ");
  let shownCount = 0;
  let misheardShown = false;
  const step = () => {
    const chunk = 1 + Math.floor(Math.random() * 3); // 1-3 words per partial
    shownCount = Math.min(words.length, shownCount + chunk);
    const shown = words.slice(0, shownCount);
    if (revise && !misheardShown && shownCount > revise.wordIndex) {
      shown[revise.wordIndex] = revise.misheard;
      misheardShown = true; // the very next partial re-renders it corrected
    }
    liveText.value = shown.join(" ");
    // keep stepping while words remain, plus one corrective pass while the
    // misheard word is still on screen
    const needsCorrection = liveText.value !== words.slice(0, shownCount).join(" ");
    if (shownCount < words.length || needsCorrection) {
      const perWord = 90 + Math.random() * 70; // 90-160ms per word, jittered
      revealTimers.push(window.setTimeout(step, Math.round(perWord * chunk)));
    }
  };
  step();
}
/** The user finished speaking: commit the canonical utterance and show the
 *  agent WORKING (Companion's activity line - the product's own affordance
 *  for "busy between messages"). The reply comes separately, later. */
function commitUser(working: string) {
  if (jitter) window.clearInterval(jitter);
  revealTimers.forEach((t) => window.clearTimeout(t));
  revealTimers = [];
  feed.value = [
    ...feed.value,
    { id: feed.value.length + 1, role: "user", text: currentUtterance || liveText.value },
  ];
  liveText.value = "";
  level.value = 0;
  mode.value = "idle"; // not speaking - thinking
  activity.value = working;
}
function agentReply(reply: string) {
  activity.value = null;
  mode.value = "claude";
  feed.value = [...feed.value, { id: feed.value.length + 1, role: "claude", text: reply }];
}

function runLoop() {
  // 1 - the widget alone, larger than life, already speaking
  at(300, () => {
    widgetIn.value = true;
    aloft.value = true;
    feed.value = [{ id: 0, role: "claude", text: "I'm ready." }];
    mode.value = "claude";
    level.value = 0.4;
  });
  at(1800, () => {
    feed.value = [...feed.value, { id: 1, role: "claude", text: "Your session is running. I'll keep you posted."}];
  });
  // 2 - the terminal rises in underneath and the widget lands on it
  at(3200, () => {
    terminalIn.value = true;
    visibleLines.value = 1;
  });
  at(3700, () => (visibleLines.value = 2));
  at(4000, () => {
    aloft.value = false; // settle down onto the session, dock bottom-right
    level.value = 0;
  });
  at(4600, () => (visibleLines.value = 3));
  at(5300, () => (visibleLines.value = 4));
  // 3 - the spoken exchange drives the work. Paced with AIR: the agent
  // visibly works (activity line) before each answer instead of replying
  // the instant the user stops talking.
  // the one tasteful mid-utterance correction: the STT first hears
  // "web hook?", the next partial fixes it - once per loop, nowhere else
  // fillers ("um,"/"uh,") are part of the transcript, revealed like any
  // other word - one per utterance, start only, so it stays human rather
  // than caricature
  at(6200, () => startTalking("um, what's wrong with the webhook?", { wordIndex: 5, misheard: "web hook?" }));
  at(7600, () => commitUser("reading webhooks/handler.ts"));
  at(8300, () => (visibleLines.value = 5));
  at(9500, () => (visibleLines.value = 6));
  // ~3.6s of visible thinking before the diagnosis lands - the terminal
  // keeps working underneath, so the pause reads as real investigation
  at(11200, () => agentReply("Bad signatures were retried forever. I made them fail fast."));
  at(12000, () => (visibleLines.value = 7));
  // REACTION PAUSE: a real person reads the diagnosis and thinks before
  // answering - the user starts ~3.2s after the reply lands, not instantly
  at(14400, () => startTalking("uh, good - run the full suite"));
  at(15700, () => commitUser("running npm test"));
  at(16300, () => (visibleLines.value = 8));
  // ~2s beat - kicking off tests takes less thought than a diagnosis
  at(17700, () => agentReply("Running - both paths are pinned by the new test."));
  at(18400, () => {
    visibleLines.value = 9;
    mode.value = "idle";
  });
  at(19000, () => (visibleLines.value = 10));
  // 4 - hold the finished frame, fade out, reset UNSEEN, pause, restart.
  // The reset must happen strictly while the stage is invisible: clearing
  // the feed on a visible frame reads as a glitch (stale messages flashing
  // against a restarting intro - Krzysztof's live-test finding).
  at(20900, () => (faded.value = true)); // ~1.9s beat on the finished state
  at(21450, () => {
    // fade-out is 0.35s, so at +550ms the stage is fully transparent -
    // everything resets while nothing can be seen
    widgetIn.value = false;
    aloft.value = true;
    terminalIn.value = false;
    visibleLines.value = 0;
    feed.value = [];
    liveText.value = "";
    level.value = 0;
    mode.value = "idle";
    activity.value = null;
  });
  at(21850, () => (faded.value = false)); // fade the EMPTY desktop back in
  at(22250, () => {
    clear();
    runLoop();
  });
}

onMounted(() => {
  if (prefersReducedMotion()) {
    widgetIn.value = true;
    aloft.value = false;
    terminalIn.value = true;
    visibleLines.value = Infinity;
    feed.value = FULL_FEED;
    mode.value = "claude";
    return;
  }
  runLoop();
});
</script>

<template>
  <div ref="frame" class="scene-frame" :style="{ height: `${760 * scale}px` }">
    <div
      class="scene-stage"
      :class="{ faded }"
      :style="{ transform: `scale(${scale})` }"
      role="img"
      aria-label="The NOISY-CODING companion widget appears alone and alive, then settles down onto a running Claude Code terminal session, carrying the spoken exchange from its docked spot"
    >
      <div class="terminal-slot" :class="{ in: terminalIn }">
        <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
      </div>
      <transition name="widget">
        <div v-if="widgetIn" class="widget-slot" :class="{ aloft }">
          <Companion
            :mode="mode"
            voice="lux"
            :feed="feed"
            :live-text="liveText"
            :level="level"
            :activity="activity"
            :max-height="420"
            :agents="AGENTS"
          />
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
/* the scene IS a Mac desktop from frame zero - the widget lives on it */
.scene-stage {
  opacity: 1; transition: opacity 0.35s ease;
  background: url("../assets/mac-desktop.png") center / cover no-repeat;
  box-shadow: none;
}
.scene-stage.faded { opacity: 0; }
/* the base: always a notch dimmer than the widget; it slides in from
   off-stage left like a window being brought over */
.terminal-slot {
  /* 10% smaller than the previous 1140x664 slot, centered between the
     desktop's menu bar and dock so more of it shows around the window */
  position: absolute; inset: 73px 87px 89px;
  opacity: 0; transform: translateX(-1260px);
  filter: saturate(0.4) brightness(0.68);
  transition: opacity 0.5s ease, transform 1s cubic-bezier(0.22, 0.8, 0.3, 1);
}
.terminal-slot.in { opacity: 1; transform: translateX(0); }
/* the product: docked bottom-right; while aloft it hovers center stage,
   slightly larger than its final size, and lands with one transform */
.widget-slot {
  position: absolute; right: 32px; bottom: 52px;
  /* FIXED width, product parity: CompanionFloat pins the widget window at
     420px - an absolutely-positioned slot would otherwise shrink-to-fit
     and GROW with every longer bubble. Constant width, bubbles wrap. */
  width: 420px;
  transform-origin: bottom right;
  transition: transform 1.15s cubic-bezier(0.22, 0.8, 0.3, 1);
  /* no glow in this variant - the widget looks exactly like the product */
}
.widget-slot.aloft {
  transform: translate(-320px, -240px) scale(1.25);
}
/* (The 22px thread padding workaround for the top fade mask was removed:
   Companion now scopes its masks under a `scrollable` state, so a thread
   that fits renders every bubble full strength.) */
.widget-enter-active { transition: opacity 0.8s ease, transform 1.15s cubic-bezier(0.22, 0.8, 0.3, 1); }
.widget-enter-from { opacity: 0; }
/* Leave must be INSTANT: the slot's own 1.15s transform transition would
   otherwise stretch Vue's leave phase, and a leaving vnode no longer
   receives prop updates - so the old widget lingered with its stale
   bubbles into the next cycle's fade-in (the loop-restart glitch). The
   reset happens while the stage is faded to zero anyway; there is nothing
   to animate. */
.widget-leave-active { transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .terminal-slot { opacity: 1 !important; transform: translateX(0) !important; filter: saturate(0.4) brightness(0.68) !important; }
  .scene-frame * { animation: none !important; transition: none !important; }
}
</style>
