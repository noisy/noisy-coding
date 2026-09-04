<script setup lang="ts">
/** Variant E - "orbit": ambient, screensaver-ish. The whole scene tilts
 *  gently toward the mouse in 3D, the widget bobs with a glow trail, and
 *  the terminal streams its session continuously.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import ClaudeCodeMock from "@dashboard/components/marketing/ClaudeCodeMock.vue";
import Companion, { type CompanionMessage } from "@dashboard/components/Companion.vue";
import { AGENTS, FULL_FEED, prefersReducedMotion, TRANSCRIPT_LINES, useStage, useTimeline } from "./shared";

const { frame, scale } = useStage();
const { at, clear } = useTimeline();

const visibleLines = ref(0);
const feed = ref<CompanionMessage[]>(FULL_FEED.slice(0, 2));
const mode = ref<"idle" | "user" | "claude">("claude");
const streamFade = ref(false);
const tiltX = ref(0);
const tiltY = ref(0);

let onMove: ((e: MouseEvent) => void) | null = null;

/** The terminal streams forever: type out, breathe, wipe, again. */
function stream() {
  for (let i = 1; i <= TRANSCRIPT_LINES; i++) {
    at(500 + i * 700, () => (visibleLines.value = i));
  }
  at(500 + TRANSCRIPT_LINES * 700 + 1800, () => (streamFade.value = true));
  at(500 + TRANSCRIPT_LINES * 700 + 2400, () => {
    visibleLines.value = 0;
    streamFade.value = false;
  });
  // the conversation drifts along with the stream
  at(2600, () => (feed.value = FULL_FEED.slice(0, 3)));
  at(5400, () => {
    feed.value = FULL_FEED;
    mode.value = "idle";
  });
  at(8200, () => {
    feed.value = FULL_FEED.slice(0, 2);
    mode.value = "claude";
  });
  at(500 + TRANSCRIPT_LINES * 700 + 2700, () => {
    clear();
    stream();
  });
}

onMounted(() => {
  if (prefersReducedMotion()) {
    visibleLines.value = Infinity;
    feed.value = FULL_FEED;
    mode.value = "claude";
    return;
  }
  stream();
  onMove = (e: MouseEvent) => {
    const el = frame.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    tiltY.value = Math.max(-1, Math.min(1, nx)) * 6;
    tiltX.value = Math.max(-1, Math.min(1, ny)) * -5;
  };
  window.addEventListener("mousemove", onMove);
});
onBeforeUnmount(() => {
  if (onMove) window.removeEventListener("mousemove", onMove);
});
</script>

<template>
  <div ref="frame" class="scene-frame orbit-frame" :style="{ height: `${760 * scale}px` }">
    <div class="orbit-space" :style="{ transform: `perspective(1600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` }">
      <div
        class="scene-stage"
        :style="{ transform: `scale(${scale})` }"
        role="img"
        aria-label="An ambient 3D-tilted scene: the Claude Code terminal streams its session while the NOISY-CODING widget floats and glows beside it"
      >
        <div class="terminal-slot" :class="{ wiped: streamFade }">
          <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
        </div>
        <div class="widget-slot">
          <Companion :mode="mode" voice="lux" :feed="feed" :max-height="200" :agents="AGENTS" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.orbit-frame { overflow: visible; }
.orbit-space {
  position: absolute; inset: 0;
  transition: transform 0.35s ease-out;
  transform-style: preserve-3d;
  will-change: transform;
}
.terminal-slot {
  position: absolute; inset: 26px 30px;
  filter: saturate(0.7) brightness(0.82);
  transition: opacity 0.6s ease;
}
.terminal-slot.wiped { opacity: 0; }
/* bob + glow live on the wrapper as transform and drop-shadow filters, so
   the glow hugs the visible bubbles/hexagon/avatars - the wrapper's
   rectangle never gets drawn */
.widget-slot {
  position: absolute; right: 32px; bottom: 28px;
  animation: bob 5.5s ease-in-out infinite;
}
@keyframes bob {
  0%, 100% {
    transform: translateY(0);
    filter: drop-shadow(0 8px 14px rgba(63, 216, 255, 0.14));
  }
  50% {
    transform: translateY(-16px);
    filter: drop-shadow(0 24px 22px rgba(63, 216, 255, 0.32));
  }
}
@media (prefers-reduced-motion: reduce) {
  .scene-frame * { animation: none !important; transition: none !important; }
  .orbit-space { transform: none !important; }
}
</style>
