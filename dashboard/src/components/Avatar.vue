<script setup lang="ts">
import { computed } from "vue";
import { VOICES } from "./characterMath";

// PoC voice portraits from the 6×6 sprite sheet in public/avatars.png
// (34 usable cells; the last two are empty). Cells are assigned by hand:
// a few are thematic matches (leo→lion, luna→moon, rex→crown, helios→
// glow, zenith→halo), the rest fill in by gender. Unknown voices fall
// back to the monogram hexagon.
const SPRITE_GRID = 6;
const SPRITE_CELL: Record<string, number> = {
  // female
  ara: 1, carina: 3, eve: 5, iris: 10, luna: 15, celeste: 16, ursa: 29,
  // male
  altair: 0, atlas: 2, sal: 4, kepler: 6, rex: 8, cosmo: 9, helios: 14,
  leo: 12, lux: 13, sirius: 17, castor: 18, naksh: 19, helix: 21,
  perseus: 22, orion: 23, lumen: 24, rigel: 27, zenith: 31, zagan: 30,
};

const props = defineProps<{
  voice: string;
  speaking?: boolean;
}>();

const cell = computed(() => SPRITE_CELL[props.voice]);
const spriteStyle = computed(() => {
  if (cell.value == null) return null;
  const col = cell.value % SPRITE_GRID;
  const row = Math.floor(cell.value / SPRITE_GRID);
  return {
    backgroundImage: "url(/avatars.png)",
    backgroundSize: `${SPRITE_GRID * 100}%`,
    backgroundPosition: `${(col / (SPRITE_GRID - 1)) * 100}% ${(row / (SPRITE_GRID - 1)) * 100}%`,
  };
});

// Fallback identity for voices without a portrait: deterministic
// per-voice color + monogram.
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
    <div v-if="spriteStyle" class="portrait" :style="spriteStyle" />
    <svg v-else viewBox="0 0 92 92" aria-hidden="true">
      <polygon
        points="46,4 82,25 82,67 46,88 10,67 10,25"
        :fill="dim" :stroke="color" stroke-width="2"
      />
      <text x="46" y="56" text-anchor="middle" :fill="color" class="mono">{{ monogram }}</text>
    </svg>
    <div class="who">
      <span class="vname" :style="{ color: spriteStyle ? undefined : color }">{{ voice.toUpperCase() || "—" }}</span>
      <span class="vg">{{ gender }}</span>
      <span v-if="speaking" class="onair">◉ ON AIR</span>
    </div>
  </div>
</template>

<style scoped>
.avatar { display: flex; align-items: center; gap: 14px; }
.portrait {
  width: 96px;
  height: 96px;
  flex: none;
  border: 1px solid var(--line-strong);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  filter: saturate(1.05);
  box-shadow: 0 0 14px rgba(63, 216, 255, 0.12);
}
.avatar.speaking .portrait { box-shadow: 0 0 18px rgba(63, 216, 255, 0.4); }
.avatar svg { width: 84px; flex: none; }
.mono { font-family: var(--mono); font-size: 34px; font-weight: 700; letter-spacing: 0.05em; }
.who { display: flex; flex-direction: column; gap: 4px; }
.vname { font-size: 14px; font-weight: 700; letter-spacing: 0.26em; color: var(--cyan-hi); }
.vg { font-size: 9px; letter-spacing: 0.3em; color: var(--muted); }
.onair {
  font-size: 9px;
  letter-spacing: 0.24em;
  color: var(--green, #6dff9e);
  animation: onair-pulse 1.2s ease-in-out infinite;
}
@keyframes onair-pulse { 50% { opacity: 0.4; } }
</style>
