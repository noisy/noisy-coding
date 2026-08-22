<script setup lang="ts">
/** Always-on-top companion (#28) - PoC, Storybook only.
 *
 * Conventions locked with Krzysztof (2026-08-22):
 *  - everything from the agent sits on the RIGHT, like the dashboard;
 *  - the freshest message is at the BOTTOM, older ones drift up, dimmed;
 *  - the head never flips (no mirror) and anchors bottom-right;
 *  - the user's live words render through the SAME Bubble component the
 *    dashboard uses (compact mode) - one message-rendering logic;
 *  - user-talking indicator: the hexagon logo breathing like the
 *    audio spectrum.
 */
import { computed } from "vue";
import Bubble from "./Bubble.vue";
import { voiceSpriteStyle } from "./voiceSprites";

const props = withDefaults(
  defineProps<{
    mode?: "claude" | "user" | "idle";
    voice?: string;
    /** Oldest first; the last entry is the freshest (bottom). */
    messages?: string[];
    /** Live transcript while the user talks (grows as they speak). */
    liveText?: string;
    avatar?: "circle" | "square";
  }>(),
  { mode: "idle", voice: "rex", messages: () => [], liveText: "", avatar: "circle" },
);

const portrait = computed(() => {
  const style = voiceSpriteStyle(props.voice);
  if (!style) return {};
  // No mirror in the companion - the head faces the way the artwork does.
  const { transform: _drop, ...rest } = style;
  return rest;
});
const bars = [42, 78, 55, 96, 63, 84, 47];
</script>

<template>
  <div class="companion">
    <!-- Claude: bubbles stack upward, head pinned bottom-right. -->
    <div v-if="mode === 'claude'" class="claude">
      <div class="msgs">
        <Bubble
          v-for="(text, i) in messages"
          :key="i"
          :class="{ older: i < messages.length - 1 }"
          compact
          side="right"
          accent="violet"
          who="" status-kind="off" status-label="" time=""
          :text="text"
        />
      </div>
      <span class="head" :class="avatar" :style="portrait" />
    </div>

    <!-- The user talking: hexagon spectrum + their words, live, through
         the same Bubble (user = left side, amber - dashboard convention). -->
    <div v-else-if="mode === 'user'" class="user">
      <svg viewBox="0 0 100 100" class="hex">
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27"
          fill="none" stroke="currentColor" stroke-width="5" />
        <g class="spectrum">
          <rect v-for="(h, i) in bars" :key="i"
            :x="26 + i * 7.5" :y="50 - h / 5" width="4.5" :height="h / 2.5"
            rx="2" :style="`animation-delay: ${i * 0.09}s`" />
        </g>
      </svg>
      <Bubble
        v-if="liveText"
        class="livebubble"
        compact live
        side="left"
        accent="amber"
        who="" status-kind="rec" status-label="" time=""
        :text="liveText"
      />
      <span v-else class="listening">LISTENING</span>
    </div>

    <div v-else class="idle">
      <svg viewBox="0 0 100 100" class="hex dim">
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27"
          fill="none" stroke="currentColor" stroke-width="5" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.companion {
  width: 380px; min-height: 96px;
  background: rgba(5, 14, 24, 0.92);
  border: 1px solid rgba(63, 216, 255, 0.25);
  border-radius: 14px;
  padding: 14px;
  font-family: var(--mono);
  display: flex; align-items: flex-end;
}

/* --- Claude speaking: column of bubbles + bottom-right head ------------- */
.claude { display: flex; gap: 12px; align-items: flex-end; width: 100%; }
.msgs {
  display: flex; flex-direction: column; gap: 6px;
  flex: 1; min-width: 0; align-items: flex-end;
}
.msgs .older { opacity: 0.45; }
.head {
  flex: none; width: 56px; height: 56px;
  border: 2px solid var(--violet);
  box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 55%, transparent);
  animation: head-bob 1.6s ease-in-out infinite;
}
.head.circle { border-radius: 50%; }
.head.square { border-radius: 10px; }
@keyframes head-bob { 50% { translate: 0 -2px; } }

/* --- user talking -------------------------------------------------------- */
.user { display: flex; align-items: center; gap: 14px; width: 100%; }
.hex { width: 64px; height: 64px; color: var(--amber); flex: none; }
.hex .spectrum rect {
  fill: var(--amber);
  transform-origin: center 50px;
  animation: eq-bar 0.7s ease-in-out infinite;
}
@keyframes eq-bar { 50% { transform: scaleY(0.3); } }
.livebubble { flex: 1; min-width: 0; }
.listening {
  font-size: 11px; letter-spacing: 0.34em; color: var(--amber);
  text-shadow: var(--glow-amber);
  animation: fade 1.4s ease-in-out infinite;
}
@keyframes fade { 50% { opacity: 0.45; } }

/* --- idle ----------------------------------------------------------------- */
.idle { width: 100%; display: flex; justify-content: center; }
.hex.dim { color: var(--muted); opacity: 0.5; width: 44px; height: 44px; }
</style>
