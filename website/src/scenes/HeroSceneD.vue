<script setup lang="ts">
/** Variant D - "split screen versus": the keyboard era on the left in
 *  grayscale, the talking era on the right in full color with the widget.
 *  A divider sweeps across and the color side takes the whole frame.
 */
import { onMounted, ref } from "vue";
import ClaudeCodeMock from "@dashboard/components/marketing/ClaudeCodeMock.vue";
import Companion, { type CompanionMessage } from "@dashboard/components/Companion.vue";
import { AGENTS, FULL_FEED, prefersReducedMotion, useStage, useTimeline } from "./shared";

const { frame, scale } = useStage();
const { at, clear } = useTimeline();

/** Divider position as % from the left; 50 = even split, 0 = color wins. */
const cut = ref(50);
const visibleLines = ref(0);
const feed = ref<CompanionMessage[]>([]);
const mode = ref<"idle" | "user" | "claude">("idle");
const labelsOn = ref(true);
const faded = ref(false);

function runLoop() {
  cut.value = 50;
  labelsOn.value = true;
  // both eras type the same session
  at(400, () => (visibleLines.value = 2));
  at(1300, () => (visibleLines.value = 4));
  at(2200, () => (visibleLines.value = 6));
  // only the talking side gets the conversation
  at(2600, () => {
    mode.value = "claude";
    feed.value = FULL_FEED.slice(0, 2);
  });
  at(4000, () => {
    feed.value = FULL_FEED.slice(0, 3);
    visibleLines.value = 7;
  });
  at(5200, () => {
    feed.value = FULL_FEED;
    visibleLines.value = 10;
  });
  // the sweep: color side wins the whole frame
  at(6400, () => {
    labelsOn.value = false;
    cut.value = 0;
  });
  at(8200, () => (mode.value = "idle"));
  at(11000, () => (faded.value = true));
  at(11450, () => {
    visibleLines.value = 0;
    feed.value = [];
    mode.value = "idle";
    cut.value = 50;
    labelsOn.value = true;
  });
  at(11700, () => (faded.value = false));
  at(12000, () => {
    clear();
    runLoop();
  });
}

onMounted(() => {
  if (prefersReducedMotion()) {
    cut.value = 0;
    labelsOn.value = false;
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
      :style="{ transform: `scale(${scale})`, '--cut': `${cut}%` }"
      role="img"
      aria-label="Split screen: the same Claude Code session typed in grayscale on the left and spoken in color with the NOISY-CODING widget on the right; the color side sweeps across and wins"
    >
      <!-- the keyboard era: terminal only, drained of color -->
      <div class="era era-typing">
        <div class="terminal-slot">
          <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
        </div>
      </div>
      <!-- the talking era: same terminal, full color, widget on top -->
      <div class="era era-talking">
        <div class="terminal-slot">
          <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
        </div>
        <div class="widget-slot">
          <Companion :mode="mode" voice="lux" :feed="feed" :max-height="200" :agents="AGENTS" />
        </div>
      </div>
      <div class="divider"></div>
      <div class="era-label label-typing" :class="{ on: labelsOn }">Typing</div>
      <div class="era-label label-talking" :class="{ on: labelsOn }">Talking</div>
    </div>
  </div>
</template>

<style scoped>
.scene-stage { opacity: 1; transition: opacity 0.35s ease; }
.scene-stage.faded { opacity: 0; }
.era { position: absolute; inset: 0; }
.terminal-slot { position: absolute; inset: 26px 30px; }
.era-typing { filter: grayscale(1) brightness(0.72); }
.era-talking {
  clip-path: inset(0 0 0 var(--cut));
  transition: clip-path 1.5s cubic-bezier(0.22, 0.8, 0.3, 1);
}
.widget-slot { position: absolute; right: 32px; bottom: 28px; }
.divider {
  position: absolute; top: 0; bottom: 0; left: var(--cut); width: 3px;
  margin-left: -1.5px;
  background: linear-gradient(180deg, transparent, #3fd8ff 18%, #3fd8ff 82%, transparent);
  box-shadow: 0 0 18px rgba(63, 216, 255, 0.8);
  transition: left 1.5s cubic-bezier(0.22, 0.8, 0.3, 1), opacity 0.6s ease;
  opacity: 1;
}
.scene-stage[style*="--cut: 0%"] .divider { opacity: 0; }
.era-label {
  position: absolute; top: 36px;
  font-family: "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 15px; letter-spacing: 0.32em; text-transform: uppercase;
  padding: 8px 18px; opacity: 0; transition: opacity 0.6s ease;
  pointer-events: none;
}
.era-label.on { opacity: 1; }
.label-typing {
  left: 6%; color: #9aa0ae;
  background: rgba(10, 10, 12, 0.8); border: 1px solid rgba(255, 255, 255, 0.16);
}
.label-talking {
  right: 6%; color: #3fd8ff;
  text-shadow: 0 0 12px rgba(63, 216, 255, 0.55);
  background: rgba(5, 14, 24, 0.8); border: 1px solid rgba(63, 216, 255, 0.55);
}
@media (prefers-reduced-motion: reduce) {
  .scene-frame * { animation: none !important; transition: none !important; }
}
</style>
