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

export interface CompanionMessage {
  role: "user" | "claude";
  text: string;
}

const props = withDefaults(
  defineProps<{
    /** idle = just the recent feed; the widget never shows dead chrome. */
    mode?: "claude" | "user" | "idle";
    voice?: string;
    /** Mixed feed, oldest first - user amber/left, claude violet/right,
     * both through the shared Bubble. Freshest sits at the bottom. */
    feed?: CompanionMessage[];
    /** Live transcript while the user talks (grows as they speak). */
    liveText?: string;
    avatar?: "circle" | "square";
  }>(),
  { mode: "idle", voice: "rex", feed: () => [], avatar: "circle", liveText: "" },
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
    <div class="column">
      <!-- The shared feed: one thread, both voices, freshest at the bottom.
           New bubbles slide in; older ones dim. -->
      <transition-group name="arrive" tag="div" class="msgs">
        <Bubble
          v-for="(m, i) in feed"
          :key="i"
          :class="{ older: i < feed.length - 1 || mode === 'user' }"
          compact
          :side="m.role === 'claude' ? 'right' : 'left'"
          :accent="m.role === 'claude' ? 'violet' : 'amber'"
          who="" status-kind="off" status-label="" time=""
          :text="m.text"
        />
      </transition-group>

      <!-- Active row: whoever holds the floor right now. -->
      <div v-if="mode === 'user'" class="user arrive-row">
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
    </div>

    <!-- The head appears only while Claude speaks - no dead chrome when
         idle (feedback 2026-08-22: the dim hexagon earned nothing). -->
    <transition name="pop">
      <span v-if="mode === 'claude'" class="head" :class="avatar" :style="portrait" />
    </transition>
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

/* --- the shared column ---------------------------------------------------- */
.column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.msgs { display: flex; flex-direction: column; gap: 6px; }
.msgs .older { opacity: 0.45; }
.msgs :deep(.msg.side-right) { align-self: flex-end; }
.msgs :deep(.msg.side-left) { align-self: flex-start; }

/* new message slides up into place */
.arrive-enter-active { transition: all 0.35s ease; }
.arrive-enter-from { opacity: 0; transform: translateY(14px); }
.arrive-move { transition: transform 0.35s ease; }

/* the head pops in when Claude takes the floor */
.pop-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.pop-enter-from { opacity: 0; transform: scale(0.4); }
.pop-leave-active { transition: all 0.2s ease; }
.pop-leave-to { opacity: 0; transform: scale(0.6); }
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
.arrive-row { animation: row-in 0.3s ease; }
@keyframes row-in { from { opacity: 0; transform: translateY(10px); } }
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

.head { margin-left: 12px; }
</style>
