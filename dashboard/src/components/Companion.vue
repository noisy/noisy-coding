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
import { computed, nextTick, ref, watch } from "vue";
import Bubble from "./Bubble.vue";
import { voiceSpriteStyle } from "./voiceSprites";

export interface CompanionMessage {
  role: "user" | "claude";
  text: string;
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
  }>(),
  { mode: "idle", voice: "rex", feed: () => [], liveText: "", maxHeight: 200 },
);

const portrait = computed(() => {
  const style = voiceSpriteStyle(props.voice);
  if (!style) return {};
  // No mirror in the companion - the head faces the way the artwork does.
  const { transform: _drop, ...rest } = style;
  return rest;
});
const bars = [42, 78, 55, 96, 63, 84, 47];

const scroller = ref<HTMLElement | null>(null);
async function stickToBottom(): Promise<void> {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
}
watch(() => [props.feed.length, props.liveText], stickToBottom, { immediate: true });
</script>

<template>
  <div class="companion">
    <!-- Left rail: the user's indicator. Lights up while they talk. -->
    <div class="rail left" :class="{ active: mode === 'user' }">
      <svg viewBox="0 0 100 100" class="hex">
        <polygon points="50,4 90,27 90,73 50,96 10,73 10,27"
          fill="none" stroke="currentColor" stroke-width="5" />
        <g v-if="mode === 'user'" class="spectrum">
          <rect v-for="(h, i) in bars" :key="i"
            :x="26 + i * 7.5" :y="50 - h / 5" width="4.5" :height="h / 2.5"
            rx="2" :style="`animation-delay: ${i * 0.09}s`" />
        </g>
      </svg>
    </div>

    <!-- The thread: pixel-clamped, scrollable, pinned to the newest. -->
    <div ref="scroller" class="thread" :style="{ maxHeight: maxHeight + 'px' }">
      <transition-group name="arrive" tag="div" class="msgs">
        <Bubble
          v-for="(m, i) in feed"
          :key="i"
          :class="{ older: i < feed.length - 1 || !!liveText }"
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
        compact live
        side="left"
        accent="amber"
        who="" status-kind="rec" status-label="" time=""
        :text="liveText"
      />
      <span v-else-if="mode === 'user'" class="listening">LISTENING</span>
    </div>

    <!-- Right rail: Claude's head. Lights up while he speaks. -->
    <div class="rail right" :class="{ active: mode === 'claude' }">
      <span class="head" :style="portrait" />
    </div>
  </div>
</template>

<style scoped>
.companion {
  width: 420px;
  background: rgba(5, 14, 24, 0.92);
  border: 1px solid rgba(63, 216, 255, 0.25);
  border-radius: 14px;
  padding: 12px;
  font-family: var(--mono);
  display: flex; gap: 10px; align-items: flex-end;
}

/* --- rails: always there, dim until their side holds the floor ---------- */
.rail { flex: none; opacity: 0.35; transition: opacity 0.3s ease; }
.rail.active { opacity: 1; }

.hex { width: 44px; height: 44px; color: var(--amber); display: block; }
.rail.active .hex { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--amber) 70%, transparent)); }
.hex .spectrum rect {
  fill: var(--amber);
  transform-origin: center 50px;
  animation: eq-bar 0.7s ease-in-out infinite;
}
@keyframes eq-bar { 50% { transform: scaleY(0.3); } }

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
  display: flex; flex-direction: column; gap: 6px;
  /* scrollbar in our idiom: a hair of cyan, only when you look for it */
  scrollbar-width: thin;
  scrollbar-color: rgba(63, 216, 255, 0.25) transparent;
  /* older messages melt away at the top edge */
  mask-image: linear-gradient(to bottom, transparent, black 22px);
}
.thread::-webkit-scrollbar { width: 4px; }
.thread::-webkit-scrollbar-track { background: transparent; }
.thread::-webkit-scrollbar-thumb {
  background: rgba(63, 216, 255, 0.18);
  border-radius: 2px;
}
.thread:hover::-webkit-scrollbar-thumb { background: rgba(63, 216, 255, 0.4); }
.msgs { display: flex; flex-direction: column; gap: 6px; }
.msgs .older { opacity: 0.55; }
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
