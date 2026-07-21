<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Character } from "../types";
import { pointerAngleDeg, speedFromAngle, traitValueFromAngle } from "./characterMath";

const props = defineProps<{ character: Character }>();
const emit = defineEmits<{ change: [patch: Partial<Character>] }>();

type Trait = "humor" | "honesty" | "brevity" | "chatty";

// Editing preview: values follow the pointer instantly; the daemon's
// answer (next poll) becomes the truth and clears the preview.
const preview = ref<Partial<Character>>({});
watch(
  () => props.character,
  () => {
    preview.value = {};
  },
);
const shown = computed<Character>(() => ({ ...props.character, ...preview.value }));

const GAUGE_R = 30;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;
const SWEEP = 0.78; // 280° arc, like the prototype

const gauges = computed(() =>
  (
    [
      ["humor", "HUMOR", "dry ↔ playful", "#3fd8ff"],
      ["honesty", "HONESTY", "dipl ↔ blunt", "#4dffb4"],
      ["brevity", "BREVITY", "detail ↔ terse", "#ffb454"],
      ["chatty", "CHATTY", "rare ↔ frequent", "var(--violet)"],
    ] as const
  ).map(([key, label, scale, color]) => {
    const value = shown.value[key];
    return {
      key: key as Trait,
      label,
      scale,
      value,
      color,
      dash: `${(CIRCUMFERENCE * SWEEP * value) / 100} ${CIRCUMFERENCE}`,
    };
  }),
);

const trackDash = `${CIRCUMFERENCE * SWEEP} ${CIRCUMFERENCE}`;

const speedDash = computed(() => {
  const fraction = Math.max(0, Math.min(1, (shown.value.speed - 0.7) / 0.8));
  const c = 2 * Math.PI * 24;
  return `${(c * 250 * fraction) / 360} ${c}`;
});

function angleFromEvent(event: PointerEvent): number {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return pointerAngleDeg(
    event.clientX - box.left - box.width / 2,
    event.clientY - box.top - box.height / 2,
  );
}

function traitDown(trait: Trait, event: PointerEvent) {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  preview.value = { ...preview.value, [trait]: traitValueFromAngle(angleFromEvent(event)) };
}
function traitMove(trait: Trait, event: PointerEvent) {
  if (event.buttons & 1) {
    preview.value = { ...preview.value, [trait]: traitValueFromAngle(angleFromEvent(event)) };
  }
}
function traitUp(trait: Trait) {
  const value = preview.value[trait];
  if (value != null) emit("change", { [trait]: value });
}

function speedDown(event: PointerEvent) {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  preview.value = { ...preview.value, speed: speedFromAngle(angleFromEvent(event)) };
}
function speedMove(event: PointerEvent) {
  if (event.buttons & 1) {
    preview.value = { ...preview.value, speed: speedFromAngle(angleFromEvent(event)) };
  }
}
function speedUp() {
  if (preview.value.speed != null) emit("change", { speed: preview.value.speed });
}

</script>

<template>
  <div>
    <div class="gauges">
      <div v-for="g in gauges" :key="g.key" class="gauge">
        <svg
          viewBox="0 0 80 80"
          class="dial"
          @pointerdown="traitDown(g.key, $event)"
          @pointermove="traitMove(g.key, $event)"
          @pointerup="traitUp(g.key)"
        >
          <g transform="rotate(130 40 40)">
            <circle cx="40" cy="40" :r="GAUGE_R" fill="none" stroke="color-mix(in srgb, var(--violet) 12%, transparent)"
                    stroke-width="5" :stroke-dasharray="trackDash" stroke-linecap="round" />
            <circle cx="40" cy="40" :r="GAUGE_R" fill="none" :stroke="g.color" stroke-width="5"
                    :stroke-dasharray="g.dash" stroke-linecap="round"
                    :style="{ filter: `drop-shadow(0 0 4px ${g.color})` }" />
          </g>
        </svg>
        <span class="gv">{{ g.value }}</span>
        <div class="gl">{{ g.label }}</div>
        <div class="gs">{{ g.scale }}</div>
      </div>
    </div>

    <div class="charline">
      <span class="lbl">SPEECH RATE</span>
      <div class="speeddial">
        <svg
          viewBox="0 0 60 60"
          class="dial"
          @pointerdown="speedDown"
          @pointermove="speedMove"
          @pointerup="speedUp"
        >
          <circle cx="30" cy="30" r="24" fill="none" stroke="color-mix(in srgb, var(--violet) 15%, transparent)" stroke-width="4" />
          <circle cx="30" cy="30" r="24" fill="none" stroke="#ffb454" stroke-width="4"
                  :stroke-dasharray="speedDash" stroke-linecap="round"
                  transform="rotate(-215 30 30)"
                  style="filter: drop-shadow(0 0 4px rgba(255, 180, 84, 0.7))" />
          <circle cx="30" cy="30" r="2.5" fill="#ffb454" />
        </svg>
        <div>
          <div class="sv">{{ shown.speed.toFixed(2) }}×</div>
          <div class="sr">RANGE 0.70× – 1.50×</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gauges { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.gauge { text-align: center; position: relative; }
.gauge svg { width: 100%; max-width: 74px; }
.dial { cursor: crosshair; touch-action: none; }
.gauge .gv {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -66%);
  font-size: 13px; color: var(--cyan-hi); text-shadow: var(--glow-cyan);
  pointer-events: none;
}
.gauge .gl { font-size: 8.5px; letter-spacing: 0.18em; color: var(--muted); margin-top: 2px; }
.gauge .gs { font-size: 7.5px; letter-spacing: 0.06em; color: rgba(93, 127, 150, 0.7); margin-top: 2px; }

.charline { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.charline .lbl { font-size: 9px; letter-spacing: 0.22em; color: var(--muted); width: 78px; flex: none; }

.speeddial { flex: 1; display: flex; align-items: center; gap: 12px; }
.speeddial svg { width: 58px; flex: none; }
.speeddial .sv { font-size: 16px; color: var(--amber); text-shadow: var(--glow-amber); }
.speeddial .sr { font-size: 8.5px; color: var(--muted); letter-spacing: 0.12em; margin-top: 2px; }
</style>
