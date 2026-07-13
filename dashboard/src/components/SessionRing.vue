<script setup lang="ts">
import { computed } from "vue";
import type { Utterance } from "../types";

const props = defineProps<{ utterances: Utterance[] }>();

const CX = 110;
const CY = 110;
const R = 84;
const GAP = 0.012; // radians between segments
const TAU = Math.PI * 2;

function durationOf(u: Utterance): number {
  if (u.duration_s) return u.duration_s;
  // Older cards lack real durations — estimate: speech ≈ 15 chars/second.
  return Math.max(2, u.text.length / 15);
}

const turns = computed(() =>
  props.utterances
    .filter((u) => u.committed_at > 0 && u.role !== "system")
    .sort((a, b) => a.committed_at - b.committed_at),
);

interface Segment {
  d: string;
  color: string;
}

const segments = computed<Segment[]>(() => {
  const list = turns.value;
  if (!list.length) return [];
  const total = list.reduce((s, u) => s + durationOf(u), 0);
  let angle = -Math.PI / 2;
  const out: Segment[] = [];
  for (const u of list) {
    const span = (durationOf(u) / total) * (TAU - GAP * list.length);
    const a2 = angle + span;
    const large = span > Math.PI ? 1 : 0;
    const x1 = CX + Math.cos(angle) * R;
    const y1 = CY + Math.sin(angle) * R;
    const x2 = CX + Math.cos(a2) * R;
    const y2 = CY + Math.sin(a2) * R;
    out.push({
      d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      color: u.role === "user" ? "#ffb454" : "#b98cff",
    });
    angle = a2 + GAP;
  }
  return out;
});

const nowMarker = computed(() => {
  if (!segments.value.length) return null;
  // End of the last segment (where `angle` stopped, minus the last gap).
  const list = turns.value;
  const total = list.reduce((s, u) => s + durationOf(u), 0);
  const sweep = TAU - GAP * list.length;
  const angle = -Math.PI / 2 + (total / total) * sweep + GAP * (list.length - 1);
  return { x: CX + Math.cos(angle) * R, y: CY + Math.sin(angle) * R };
});

const counts = computed(() => ({
  you: turns.value.filter((u) => u.role === "user").length,
  claude: turns.value.filter((u) => u.role === "claude").length,
}));

const elapsed = computed(() => {
  const list = turns.value;
  if (list.length < 2) return "—";
  const seconds = Math.max(0, list[list.length - 1].committed_at - list[0].committed_at);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ELAPSED`;
});

const ticks = [0, 90, 180, 270].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return {
    x1: CX + Math.cos(a) * (R + 12),
    y1: CY + Math.sin(a) * (R + 12),
    x2: CX + Math.cos(a) * (R + 20),
    y2: CY + Math.sin(a) * (R + 20),
  };
});
</script>

<template>
  <div class="ringbox">
    <svg viewBox="0 0 220 220" aria-label="Conversation timeline ring">
      <circle :cx="CX" :cy="CY" :r="R + 16" fill="none" stroke="rgba(63,216,255,0.15)" stroke-width="1" />
      <g class="reticle">
        <circle :cx="CX" :cy="CY" :r="R + 16" fill="none" stroke="rgba(63,216,255,0.4)"
                stroke-width="1" stroke-dasharray="4 34" />
        <line v-for="(t, i) in ticks" :key="i" v-bind="t" stroke="rgba(63,216,255,0.5)" stroke-width="1.4" />
      </g>
      <circle :cx="CX" :cy="CY" :r="R - 14" fill="none" stroke="rgba(63,216,255,0.12)" stroke-width="1" />
      <path
        v-for="(seg, i) in segments"
        :key="i"
        class="seg"
        :d="seg.d"
        fill="none"
        :stroke="seg.color"
        stroke-width="9"
        opacity="0.9"
        :style="{ filter: `drop-shadow(0 0 3px ${seg.color})` }"
      />
      <circle v-if="nowMarker" :cx="nowMarker.x" :cy="nowMarker.y" r="4.5" fill="#3fd8ff"
              style="filter: drop-shadow(0 0 5px #3fd8ff)" />
    </svg>
    <div class="ringcenter">
      <div class="rc1">{{ turns.length }}</div>
      <div class="rc2">TURNS</div>
      <div class="rc3">{{ elapsed }}</div>
    </div>
  </div>
  <div class="ringlegend">
    <span class="l-you"><i />YOU · {{ counts.you }}</span>
    <span class="l-cl"><i />CLAUDE · {{ counts.claude }}</span>
  </div>
</template>

<style scoped>
.ringbox { position: relative; display: grid; place-items: center; padding: 4px 0 2px; }
.ringbox svg { width: 200px; max-width: 100%; }
.ringcenter { position: absolute; text-align: center; }
.rc1 { font-size: 21px; color: var(--cyan-hi); text-shadow: var(--glow-cyan); letter-spacing: 0.06em; }
.rc2 { font-size: 8.5px; letter-spacing: 0.3em; color: var(--muted); margin-top: 3px; }
.rc3 { font-size: 11px; color: var(--amber); margin-top: 7px; letter-spacing: 0.1em; }
.ringlegend { display: flex; justify-content: center; gap: 18px; margin-top: 10px; font-size: 9px; letter-spacing: 0.14em; color: var(--muted); }
.ringlegend i { display: inline-block; width: 8px; height: 8px; margin-right: 5px; vertical-align: -1px; }
.ringlegend .l-you i { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
.ringlegend .l-cl i { background: var(--violet); box-shadow: 0 0 6px var(--violet); }
.reticle { animation: spin 40s linear infinite; transform-origin: center; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
