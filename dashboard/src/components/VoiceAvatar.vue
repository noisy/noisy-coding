<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ voice: string; size?: number }>(), { size: 48 });
const palettes = [
  { background: "#2c394b", color: "#c4d8f7" },
  { background: "#3a3248", color: "#ded0f3" },
  { background: "#2c3c35", color: "#bedfca" },
  { background: "#423728", color: "#ecd3aa" },
  { background: "#423136", color: "#edc6ce" },
  { background: "#2b3c40", color: "#bddde3" },
];
const palette = computed(() => {
  const hash = [...props.voice.toLowerCase()].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  return palettes[(hash >>> 0) % palettes.length];
});
const monogram = computed(() => props.voice.trim().slice(0, 3).toUpperCase() || "—");
</script>

<template>
  <span class="voice-avatar" aria-hidden="true" :style="{
    ...palette, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.27)}px`,
  }">{{ monogram }}</span>
</template>

<style scoped>
.voice-avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 24%; font-family: var(--sans); font-weight: 650; line-height: 1; user-select: none; }
</style>
