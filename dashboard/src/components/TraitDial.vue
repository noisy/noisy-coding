<script setup lang="ts">
/** One character trait as an editable radial dial.
 *
 * The circle is 6 equal 60° wedges: the bottom one is a decorative gap
 * (clicking it means 0), the other 5 form a 300° arc whose 6 boundaries are
 * the stops 0/20/40/60/80/100. Clicking anywhere in a wedge selects it; a
 * glowing handle marks the value; the semantic word sits under the number.
 *
 * The parent passes an explicit `color` — NOT var(--cyan) — so the persona
 * rail's cyan→violet recolor can't hijack it (that override is why humor
 * used to render violet here). Value changes are emitted, not mutated.
 */
import { computed } from "vue";
import { SEG_ARC_START_DEG, SEG_ARC_SWEEP_DEG, segStopAngle, segTraitFromAngle, TRAIT_STOPS } from "./characterMath";
import { pointerAngleDeg } from "./characterMath";

const props = defineProps<{ value: number; label: string; word: string; color: string }>();
const emit = defineEmits<{ input: [value: number]; commit: [value: number] }>();

const GAUGE_R = 30;
const CENTER = 40;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;
const SWEEP = SEG_ARC_SWEEP_DEG / 360;
const trackDash = `${CIRCUMFERENCE * SWEEP} ${CIRCUMFERENCE}`;
const ARC_ROTATION = SEG_ARC_START_DEG;

function pointAt(v: number) {
  const a = (segStopAngle(v) * Math.PI) / 180;
  return { x: CENTER + GAUGE_R * Math.cos(a), y: CENTER + GAUGE_R * Math.sin(a) };
}

const dash = computed(() => `${(CIRCUMFERENCE * SWEEP * props.value) / 100} ${CIRCUMFERENCE}`);
const handle = computed(() => pointAt(props.value));
const ticks = computed(() => TRAIT_STOPS.map((s) => ({ s, ...pointAt(s) })));

function angleFromEvent(event: PointerEvent): number {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return pointerAngleDeg(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2);
}
function down(event: PointerEvent) {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  emit("input", segTraitFromAngle(angleFromEvent(event)));
}
function move(event: PointerEvent) {
  if (event.buttons & 1) emit("input", segTraitFromAngle(angleFromEvent(event)));
}
function up() {
  emit("commit", props.value);
}
</script>

<template>
  <div class="gauge">
    <svg viewBox="0 0 80 80" class="dial" @pointerdown="down" @pointermove="move" @pointerup="up">
      <g :transform="`rotate(${ARC_ROTATION} 40 40)`">
        <circle
          cx="40" cy="40" :r="GAUGE_R" fill="none"
          :stroke="`color-mix(in srgb, ${color} 14%, transparent)`"
          stroke-width="5" :stroke-dasharray="trackDash" stroke-linecap="round"
        />
        <circle
          cx="40" cy="40" :r="GAUGE_R" fill="none" :stroke="color" stroke-width="5"
          :stroke-dasharray="dash" stroke-linecap="round"
          :style="{ filter: `drop-shadow(0 0 4px ${color})` }"
        />
      </g>
      <circle
        v-for="t in ticks" :key="t.s" :cx="t.x" :cy="t.y" r="1.7"
        :fill="t.s <= value ? 'var(--panel-solid)' : `color-mix(in srgb, ${color} 45%, transparent)`"
        :stroke="t.s <= value ? color : 'none'" stroke-width="1"
      />
      <circle :cx="handle.x" :cy="handle.y" r="4.2" :fill="color"
              stroke="var(--panel-solid)" stroke-width="1.5"
              :style="{ filter: `drop-shadow(0 0 5px ${color})` }" />
    </svg>
    <span class="gv">{{ value }}</span>
    <div class="gl">{{ label }}</div>
    <div class="gw" :style="{ color }">{{ word }}</div>
  </div>
</template>

<style scoped>
.gauge { text-align: center; position: relative; }
.gauge svg { width: 100%; max-width: 74px; }
.dial { cursor: pointer; touch-action: none; }
.gauge .gv {
  position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%);
  font-size: 14px; color: var(--ink); text-shadow: 0 0 6px currentColor;
  pointer-events: none;
}
.gauge .gl {
  font-size: 11px; letter-spacing: 0.12em; color: var(--ink);
  margin-top: 4px; font-weight: 600;
}
.gauge .gw { font-size: 10.5px; letter-spacing: 0.02em; margin-top: 2px; min-height: 13px; }
</style>
