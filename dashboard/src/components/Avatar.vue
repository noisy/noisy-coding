<script setup lang="ts">
import { computed } from "vue";
import { VOICES } from "./characterMath";

// Placeholder identity portrait until the sprite avatars land (see the
// voice-avatars draft): a per-voice color and monogram, deterministic so
// the same voice always looks the same.
const props = defineProps<{
  voice: string;
  speaking?: boolean;
}>();

const hue = computed(() => {
  let h = 0;
  for (const ch of props.voice) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
});
const color = computed(() => `hsl(${hue.value}, 85%, 62%)`);
const dim = computed(() => `hsla(${hue.value}, 85%, 62%, 0.12)`);
const monogram = computed(() => (props.voice ? props.voice[0].toUpperCase() : "?"));
const gender = computed(() => (VOICES[props.voice] ?? "").toUpperCase());
</script>

<template>
  <div class="avatar" :class="{ speaking }">
    <svg viewBox="0 0 92 92" aria-hidden="true">
      <polygon
        points="46,4 82,25 82,67 46,88 10,67 10,25"
        :fill="dim" :stroke="color" stroke-width="2"
      />
      <text x="46" y="56" text-anchor="middle" :fill="color" class="mono">{{ monogram }}</text>
      <g v-if="speaking" :stroke="color" stroke-width="2.4" stroke-linecap="round" class="wave">
        <line x1="34" y1="70" x2="34" y2="76" />
        <line x1="42" y1="68" x2="42" y2="78" />
        <line x1="50" y1="70" x2="50" y2="76" />
        <line x1="58" y1="71" x2="58" y2="75" />
      </g>
    </svg>
    <div class="who">
      <span class="vname" :style="{ color }">{{ voice.toUpperCase() || "—" }}</span>
      <span class="vg">{{ gender }}</span>
    </div>
  </div>
</template>

<style scoped>
.avatar { display: flex; align-items: center; gap: 14px; }
.avatar svg { width: 72px; flex: none; filter: drop-shadow(0 0 8px rgba(63, 216, 255, 0.12)); }
.avatar.speaking svg { filter: drop-shadow(0 0 12px rgba(63, 216, 255, 0.35)); }
.mono { font-family: var(--mono); font-size: 34px; font-weight: 700; letter-spacing: 0.05em; }
.wave line { animation: avatar-wave 0.9s ease-in-out infinite; transform-origin: center; }
.wave line:nth-child(2) { animation-delay: 0.15s; }
.wave line:nth-child(3) { animation-delay: 0.3s; }
.wave line:nth-child(4) { animation-delay: 0.45s; }
@keyframes avatar-wave { 50% { opacity: 0.35; } }
.who { display: flex; flex-direction: column; gap: 4px; }
.vname { font-size: 14px; font-weight: 700; letter-spacing: 0.26em; }
.vg { font-size: 9px; letter-spacing: 0.3em; color: var(--muted); }
</style>
