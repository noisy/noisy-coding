<script setup lang="ts">
/** Variant A - the baseline three-phase story loop:
 *  dimmed terminal types (the base) -> widget arrives in full color with a
 *  glow pulse (the product) -> a spoken exchange drives the work (the loop).
 */
import { onMounted, ref } from "vue";
import ClaudeCodeMock from "@dashboard/components/marketing/ClaudeCodeMock.vue";
import Companion, { type CompanionMessage } from "@dashboard/components/Companion.vue";
import { AGENTS, FULL_FEED, prefersReducedMotion, useStage, useTimeline } from "./shared";

const { frame, scale } = useStage();
const { at, clear } = useTimeline();

const phase = ref(1);
const widgetIn = ref(false);
const visibleLines = ref(0);
const feed = ref<CompanionMessage[]>([]);
const liveText = ref("");
const level = ref(0);
const mode = ref<"idle" | "user" | "claude">("idle");
const labelCC = ref(false);
const labelNC = ref(false);
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
  phase.value = 1;
  at(400, () => (visibleLines.value = 1));
  at(700, () => (labelCC.value = true));
  at(1400, () => (visibleLines.value = 2));
  at(2400, () => (visibleLines.value = 3));
  at(3100, () => (visibleLines.value = 4));
  at(3800, () => (labelCC.value = false));
  at(4200, () => {
    phase.value = 2;
    widgetIn.value = true;
    // seed the feed like the daemon's cold start, so the widget never
    // shows its empty state on the hero
    feed.value = [{ id: 0, role: "claude", text: "I'm ready." }];
    mode.value = "claude";
  });
  at(4800, () => (labelNC.value = true));
  at(7800, () => (labelNC.value = false));
  at(5600, () => {
    phase.value = 3;
    startTalking("what's wrong with the webhook?");
  });
  at(6700, () => commitTalking("Bad signatures were retried forever. I made them fail fast."));
  at(7200, () => (visibleLines.value = 5));
  at(7700, () => (visibleLines.value = 6));
  at(8200, () => (visibleLines.value = 7));
  at(8800, () => startTalking("good, run the full suite"));
  at(9800, () => commitTalking("Running - both paths are pinned by the new test."));
  at(10400, () => (visibleLines.value = 8));
  at(11000, () => {
    visibleLines.value = 9;
    mode.value = "idle";
  });
  at(11500, () => (visibleLines.value = 10));
  at(12800, () => (faded.value = true));
  at(13200, () => {
    widgetIn.value = false;
    visibleLines.value = 0;
    feed.value = [];
    liveText.value = "";
    level.value = 0;
    mode.value = "idle";
  });
  at(13450, () => (faded.value = false));
  at(13800, () => {
    clear();
    runLoop();
  });
}

onMounted(() => {
  if (prefersReducedMotion()) {
    phase.value = 3;
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
      :class="[`phase${phase}`, { faded }]"
      :style="{ transform: `scale(${scale})` }"
      role="img"
      aria-label="A Claude Code terminal session fixing a webhook bug while the NOISY-CODING companion widget floats bottom-right, carrying the spoken exchange"
    >
      <div class="terminal-slot">
        <ClaudeCodeMock full-bleed banner="both" :visible-lines="visibleLines" />
      </div>
      <transition name="widget">
        <div v-if="widgetIn" class="widget-slot">
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
      </transition>
      <div class="scene-label label-cc" :class="{ on: labelCC }">Claude Code - your agent</div>
      <div class="scene-label label-nc" :class="{ on: labelNC }">noisy-coding - the voice on top</div>
    </div>
  </div>
</template>

<style scoped>
.scene-stage { opacity: 1; transition: opacity 0.35s ease; }
.scene-stage.faded { opacity: 0; }
.terminal-slot {
  position: absolute; inset: 26px 30px;
  transition: filter 0.8s ease;
  filter: saturate(0.55) brightness(0.85);
}
.scene-stage.phase2 .terminal-slot,
.scene-stage.phase3 .terminal-slot {
  filter: saturate(0.35) brightness(0.62);
}
.widget-slot { position: absolute; right: 32px; bottom: 28px; }
.widget-enter-active { transition: opacity 0.7s ease, transform 0.7s ease; }
.widget-enter-from { opacity: 0; transform: translateX(30px); }
/* glow follows the alpha shape of the bubbles/hexagon/avatars, never the
   wrapper's invisible rectangle */
.scene-stage.phase2 .widget-slot { animation: wpulse 2.2s ease-in-out 2; }
@keyframes wpulse {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(63, 216, 255, 0.1)); }
  50% { filter: drop-shadow(0 0 22px rgba(63, 216, 255, 0.65)); }
}
.scene-label {
  position: absolute;
  font-family: "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase;
  padding: 7px 15px; opacity: 0; transition: opacity 0.6s ease;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  pointer-events: none;
}
.scene-label.on { opacity: 1; }
.label-cc {
  bottom: 12%; left: 5%; color: #9aa0ae;
  background: rgba(22, 24, 31, 0.85); border: 1px solid rgba(255, 255, 255, 0.14);
}
.label-nc {
  right: 3%; bottom: 46%; color: #3fd8ff;
  text-shadow: 0 0 12px rgba(63, 216, 255, 0.55);
  background: rgba(5, 14, 24, 0.85); border: 1px solid rgba(63, 216, 255, 0.55);
}
@media (prefers-reduced-motion: reduce) {
  .terminal-slot { filter: none !important; }
  .scene-frame * { animation: none !important; transition: none !important; }
}
</style>
