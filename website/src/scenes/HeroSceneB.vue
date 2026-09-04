<script setup lang="ts">
/** Variant B - "spotlight reveal": the terminal opens huge and centered
 *  like a movie poster under a vignette, the camera pulls back, and the
 *  widget drops in from above with a spring bounce.
 */
import { onMounted, ref } from "vue";
import ClaudeCodeMock from "@dashboard/components/marketing/ClaudeCodeMock.vue";
import Companion, { type CompanionMessage } from "@dashboard/components/Companion.vue";
import { AGENTS, FULL_FEED, prefersReducedMotion, useStage, useTimeline } from "./shared";

const { frame, scale } = useStage();
const { at, clear } = useTimeline();

const zoomedOut = ref(false);
const widgetIn = ref(false);
const visibleLines = ref(0);
const feed = ref<CompanionMessage[]>([]);
const mode = ref<"idle" | "user" | "claude">("idle");
const vignette = ref(true);
const faded = ref(false);

function runLoop() {
  zoomedOut.value = false;
  vignette.value = true;
  // the poster: huge terminal, lines punch in one by one
  at(300, () => (visibleLines.value = 1));
  at(1000, () => (visibleLines.value = 2));
  at(1700, () => (visibleLines.value = 4));
  // camera pulls back
  at(2600, () => {
    zoomedOut.value = true;
    vignette.value = false;
  });
  // the widget drops in with a spring
  at(4200, () => {
    widgetIn.value = true;
    mode.value = "claude";
  });
  at(4600, () => (feed.value = FULL_FEED.slice(0, 1)));
  at(5600, () => (feed.value = FULL_FEED.slice(0, 2)));
  at(6200, () => (visibleLines.value = 6));
  at(6900, () => (visibleLines.value = 7));
  at(7600, () => {
    visibleLines.value = 8;
    feed.value = FULL_FEED.slice(0, 3);
  });
  at(8600, () => {
    feed.value = FULL_FEED;
    visibleLines.value = 10;
  });
  at(9400, () => (mode.value = "idle"));
  at(11200, () => (faded.value = true));
  at(11650, () => {
    widgetIn.value = false;
    visibleLines.value = 0;
    feed.value = [];
    mode.value = "idle";
  });
  at(11900, () => (faded.value = false));
  at(12200, () => {
    clear();
    runLoop();
  });
}

onMounted(() => {
  if (prefersReducedMotion()) {
    zoomedOut.value = true;
    vignette.value = false;
    widgetIn.value = true;
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
      aria-label="A cinematic reveal: a huge Claude Code terminal pulls back and the NOISY-CODING companion widget drops in over it"
    >
      <div class="camera" :class="{ out: zoomedOut }">
        <div class="terminal-slot">
          <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
        </div>
      </div>
      <div class="vignette" :class="{ off: !vignette }"></div>
      <transition name="drop">
        <div v-if="widgetIn" class="widget-slot">
          <Companion :mode="mode" voice="lux" :feed="feed" :max-height="200" :agents="AGENTS" />
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.scene-stage { opacity: 1; transition: opacity 0.35s ease; }
.scene-stage.faded { opacity: 0; }
.camera {
  position: absolute; inset: 0;
  transform: scale(1.55) translateY(6%);
  transform-origin: 42% 30%;
  transition: transform 1.6s cubic-bezier(0.22, 0.8, 0.3, 1);
}
.camera.out { transform: scale(1) translateY(0); }
.terminal-slot { position: absolute; inset: 26px 30px; }
.vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 45% 35%, transparent 30%, rgba(2, 4, 10, 0.88) 78%);
  opacity: 1; transition: opacity 1.4s ease;
}
.vignette.off { opacity: 0; }
.widget-slot { position: absolute; right: 32px; bottom: 28px; }
.drop-enter-active { animation: springdrop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes springdrop {
  0% { opacity: 0; transform: translateY(-90px); }
  60% { opacity: 1; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .scene-frame * { animation: none !important; transition: none !important; }
  .camera { transform: none; }
  .vignette { opacity: 0; }
}
</style>
