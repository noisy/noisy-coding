<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    activity: { text: string; at: number } | null;
    /** The card being spoken is rendered in this feed — drop the quote. */
    playingCardVisible?: boolean;
  }>(),
  { playingCardVisible: false },
);

// The age ticks locally between polls so the line feels alive.
const now = ref(Date.now() / 1000);
let ticker: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now() / 1000), 1000);
});
onUnmounted(() => clearInterval(ticker));

const age = computed(() => {
  if (!props.activity) return "";
  const seconds = Math.max(0, now.value - props.activity.at);
  return seconds < 60 ? `${Math.floor(seconds)}s` : `${Math.floor(seconds / 60)}m`;
});

// While the spoken card itself is on screen (▶ PLAYING right above this
// line), quoting the speech again would double it — keep only the act.
// The full quote stays for feeds where the card is absent (another tab).
const label = computed(() => {
  if (!props.activity) return "";
  if (props.playingCardVisible && props.activity.text.startsWith("SPEAKING")) {
    return "SPEAKING";
  }
  return props.activity.text;
});
</script>

<template>
  <!-- One-line pseudo-bubble at the bottom of the feed: explains a missing
       reply ("he's busy doing X") right where you'd expect the reply. -->
  <div
    v-if="activity"
    class="busyrow"
    title="Claude reads your speech while working; the reply comes when he's done."
  >
    <span class="pulse" />
    <span class="txt">CLAUDE IS BUSY — {{ label }}</span>
    <span class="age">{{ age }}</span>
  </div>
</template>

<style scoped>
.busyrow {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 88%;
  padding: 6px 12px;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--muted);
  border: 1px dashed color-mix(in srgb, var(--violet) 35%, transparent);
  border-left: 2px solid var(--violet-dim);
  background: color-mix(in srgb, var(--violet) 4%, transparent);
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}
.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--violet);
  box-shadow: 0 0 6px var(--violet);
  animation: act-pulse 1.2s ease-in-out infinite;
}
.txt {
  color: color-mix(in srgb, var(--violet) 75%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.age { flex: none; color: rgba(93, 127, 150, 0.7); }
@keyframes act-pulse { 50% { opacity: 0.35; } }
</style>
