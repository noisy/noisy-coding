<script setup lang="ts">
/** Variant F - "rewind": opens on the finished session (green tests, full
 *  conversation), then rewinds fast to an empty terminal and replays
 *  forward at speed. The loop itself is the hook.
 */
import { onMounted, ref } from "vue";
import ClaudeCodeMock from "@dashboard/components/marketing/ClaudeCodeMock.vue";
import Companion, { type CompanionMessage } from "@dashboard/components/Companion.vue";
import { AGENTS, FULL_FEED, prefersReducedMotion, TRANSCRIPT_LINES, useStage, useTimeline } from "./shared";

const { frame, scale } = useStage();
const { at, clear } = useTimeline();

const visibleLines = ref<number>(TRANSCRIPT_LINES);
const feed = ref<CompanionMessage[]>(FULL_FEED);
const mode = ref<"idle" | "user" | "claude">("idle");
const rewinding = ref(false);

function runLoop() {
  // hold the finished state - this is where you end up
  visibleLines.value = TRANSCRIPT_LINES;
  feed.value = FULL_FEED;
  mode.value = "idle";
  rewinding.value = false;

  // rewind: terminal lines and conversation unwind fast
  at(2600, () => (rewinding.value = true));
  for (let i = 0; i <= TRANSCRIPT_LINES; i++) {
    at(2600 + i * 90, () => (visibleLines.value = TRANSCRIPT_LINES - i));
  }
  at(2800, () => (feed.value = FULL_FEED.slice(0, 3)));
  at(3050, () => (feed.value = FULL_FEED.slice(0, 2)));
  at(3300, () => (feed.value = FULL_FEED.slice(0, 1)));
  at(3550, () => (feed.value = []));
  at(3800, () => (rewinding.value = false));

  // replay forward at speed - the session happens again before your eyes
  const t0 = 4400;
  const step = 340;
  for (let i = 1; i <= TRANSCRIPT_LINES; i++) {
    at(t0 + i * step, () => (visibleLines.value = i));
  }
  at(t0 + 2 * step, () => {
    mode.value = "claude";
    feed.value = FULL_FEED.slice(0, 2);
  });
  at(t0 + 6 * step, () => (feed.value = FULL_FEED.slice(0, 3)));
  at(t0 + 9 * step, () => {
    feed.value = FULL_FEED;
    mode.value = "idle";
  });
  // brief hold on the finished frame, then go again
  at(t0 + TRANSCRIPT_LINES * step + 2400, () => {
    clear();
    runLoop();
  });
}

onMounted(() => {
  if (prefersReducedMotion()) {
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
      :style="{ transform: `scale(${scale})` }"
      role="img"
      aria-label="A finished Claude Code session with the NOISY-CODING widget rewinds to empty and replays itself forward at speed"
    >
      <div class="terminal-slot" :class="{ rewinding }">
        <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
      </div>
      <div class="widget-slot" :class="{ rewinding }">
        <Companion :mode="mode" voice="lux" :feed="feed" :max-height="200" :agents="AGENTS" />
      </div>
      <div class="rewind-cue" :class="{ on: rewinding }">
        <span class="arrows">&#171;&#171;</span> REWIND
      </div>
      <div class="rewind-scan" :class="{ on: rewinding }"></div>
    </div>
  </div>
</template>

<style scoped>
.terminal-slot { position: absolute; inset: 26px 30px; }
.widget-slot { position: absolute; right: 32px; bottom: 28px; }
.terminal-slot.rewinding, .widget-slot.rewinding {
  filter: saturate(0.4) contrast(1.15);
}
.rewind-cue {
  position: absolute; top: 40px; right: 48px;
  font-family: "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 20px; letter-spacing: 0.3em; color: #ffb84d;
  text-shadow: 0 0 14px rgba(255, 184, 77, 0.7);
  opacity: 0; transition: opacity 0.25s ease;
  pointer-events: none;
}
.rewind-cue.on { opacity: 1; animation: cueblink 0.5s steps(1) infinite; }
.rewind-cue .arrows { font-size: 24px; }
@keyframes cueblink { 50% { opacity: 0.35; } }
.rewind-scan {
  position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.06) 0 2px, transparent 2px 7px);
  transition: opacity 0.25s ease;
}
.rewind-scan.on { opacity: 1; animation: scanjitter 0.18s steps(2) infinite; }
@keyframes scanjitter {
  0% { transform: translateY(0); }
  100% { transform: translateY(3px); }
}
@media (prefers-reduced-motion: reduce) {
  .scene-frame * { animation: none !important; transition: none !important; }
}
</style>
