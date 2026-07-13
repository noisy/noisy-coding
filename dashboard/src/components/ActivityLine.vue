<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  activity: { text: string; at: number } | null;
}>();

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
</script>

<template>
  <div v-if="activity" class="actline" :title="activity.text">
    <span class="pulse" />
    <span class="txt">{{ activity.text }}</span>
    <span class="age">{{ age }}</span>
  </div>
</template>

<style scoped>
.actline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--muted);
}
.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
  animation: act-pulse 1.2s ease-in-out infinite;
}
.txt {
  color: var(--cyan-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.age { margin-left: auto; flex: none; color: rgba(93, 127, 150, 0.7); }
@keyframes act-pulse { 50% { opacity: 0.35; } }
</style>
