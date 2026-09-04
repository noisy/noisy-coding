<script setup lang="ts">
/** Variant C - "conversation first": the widget stands alone center stage,
 *  talking (real spectrum pulsing), while the terminal materializes from a
 *  blur BEHIND it as the work happens - the product before the base.
 */
import { onMounted, ref } from "vue";
import ClaudeCodeMock from "@dashboard/components/marketing/ClaudeCodeMock.vue";
import Companion, { type CompanionMessage } from "@dashboard/components/Companion.vue";
import { AGENTS, FULL_FEED, prefersReducedMotion, useStage, useTimeline } from "./shared";

const { frame, scale } = useStage();
const { at, clear } = useTimeline();

const docked = ref(false);
const terminalStage = ref(0); // 0 hidden, 1 ghost, 2 clear
const visibleLines = ref(0);
const feed = ref<CompanionMessage[]>([]);
const liveText = ref("");
const level = ref(0);
const mode = ref<"idle" | "user" | "claude">("idle");
const faded = ref(false);

let jitter: number | undefined;
function startTalking(text: string) {
  mode.value = "user";
  liveText.value = text;
  level.value = 0.5;
  jitter = window.setInterval(() => (level.value = 0.3 + Math.random() * 0.5), 150);
}
function commitTalking(reply: string) {
  if (jitter) window.clearInterval(jitter);
  const next = feed.value.length + 1;
  feed.value = [...feed.value, { id: next, role: "user", text: liveText.value }];
  liveText.value = "";
  level.value = 0;
  mode.value = "claude";
  feed.value = [...feed.value, { id: next + 1, role: "claude", text: reply }];
}

function runLoop() {
  docked.value = false;
  terminalStage.value = 0;
  // the conversation opens the scene - no terminal anywhere yet
  at(600, () => startTalking("what's wrong with the webhook?"));
  at(2100, () => commitTalking("Bad signatures were retried forever. I made them fail fast."));
  // the base materializes behind the words
  at(2800, () => {
    terminalStage.value = 1;
    visibleLines.value = 2;
  });
  at(3600, () => (visibleLines.value = 4));
  at(4400, () => {
    terminalStage.value = 2;
    visibleLines.value = 6;
  });
  at(5200, () => (visibleLines.value = 7));
  at(6000, () => startTalking("good, run the full suite"));
  at(7200, () => commitTalking("Running - both paths are pinned by the new test."));
  at(7800, () => (visibleLines.value = 8));
  at(8600, () => (visibleLines.value = 10));
  // the widget glides home to its dock
  at(9200, () => {
    docked.value = true;
    mode.value = "idle";
  });
  at(11600, () => (faded.value = true));
  at(12050, () => {
    terminalStage.value = 0;
    visibleLines.value = 0;
    feed.value = [];
    mode.value = "idle";
    docked.value = false;
  });
  at(12300, () => (faded.value = false));
  at(12600, () => {
    clear();
    runLoop();
  });
}

onMounted(() => {
  if (prefersReducedMotion()) {
    docked.value = true;
    terminalStage.value = 2;
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
      aria-label="The NOISY-CODING companion widget talks center stage while the Claude Code terminal materializes from a blur behind it"
    >
      <div class="terminal-slot" :class="`t${terminalStage}`">
        <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
      </div>
      <div class="widget-slot" :class="{ docked }">
        <Companion
          :mode="mode"
          voice="lux"
          :feed="feed"
          :live-text="liveText"
          :level="level"
          :max-height="200"
          :agents="AGENTS"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-stage { opacity: 1; transition: opacity 0.35s ease; }
.scene-stage.faded { opacity: 0; }
.terminal-slot {
  position: absolute; inset: 26px 30px;
  transition: opacity 1.4s ease, filter 1.4s ease;
}
.terminal-slot.t0 { opacity: 0; filter: blur(22px) saturate(0.3); }
.terminal-slot.t1 { opacity: 0.45; filter: blur(9px) saturate(0.5); }
.terminal-slot.t2 { opacity: 1; filter: blur(0) saturate(0.6) brightness(0.75); }
.widget-slot {
  position: absolute; right: 50%; bottom: 40%;
  transform: translate(50%, 50%) scale(1.18);
  transition: right 1.1s cubic-bezier(0.22, 0.8, 0.3, 1), bottom 1.1s cubic-bezier(0.22, 0.8, 0.3, 1), transform 1.1s cubic-bezier(0.22, 0.8, 0.3, 1);
  filter: drop-shadow(0 0 34px rgba(63, 216, 255, 0.25));
}
.widget-slot.docked {
  right: 32px; bottom: 28px;
  transform: translate(0, 0) scale(1);
}
@media (prefers-reduced-motion: reduce) {
  .scene-frame * { animation: none !important; transition: none !important; }
}
</style>
