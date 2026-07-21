<script setup lang="ts">
/** The character-matrix editor: four radial trait dials (humor, honesty,
 * brevity, chatty) plus a speech-rate dial.
 *
 * The dials read as CONTROLS, not readouts, and a value is easy to hit:
 *  - the circle is 6 equal 60° wedges; the bottom wedge is a decorative gap
 *    (clicking it means 0), the other 5 form a 300° arc whose 6 boundaries
 *    are exactly the trait stops 0/20/40/60/80/100 (see characterMath);
 *  - clicking anywhere in a wedge selects that wedge's upper boundary, and a
 *    glowing handle dot marks the current value, so the ring affords dragging;
 *  - the semantic word ("warm", "frank") sits under the number, so the dial
 *    shows what the setting MEANS, not just a figure.
 * Glow and per-trait colour follow the dashboard design language.
 */
import { computed, ref, watch } from "vue";
import type { Character } from "../types";
import {
  pointerAngleDeg,
  SEG_ARC_START_DEG,
  SEG_ARC_SWEEP_DEG,
  segStopAngle,
  segTraitFromAngle,
  speedFromAngle,
  TRAIT_STOPS,
  traitWord,
} from "./characterMath";

const props = defineProps<{ character: Character }>();
const emit = defineEmits<{ change: [patch: Partial<Character>] }>();

type Trait = "humor" | "honesty" | "brevity" | "chatty";

// Editing preview: values follow the pointer instantly; the daemon's answer
// (next poll) becomes the truth and clears the preview.
const preview = ref<Partial<Character>>({});
watch(
  () => props.character,
  () => {
    preview.value = {};
  },
);
const shown = computed<Character>(() => ({ ...props.character, ...preview.value }));

// Geometry — named constants flow into the SVG (design language: "I hoped
// this was one variable" should be true). The arc is the 5 visible wedges of
// the 6-wedge segmented model (300°); the bottom 60° is the decorative gap.
const GAUGE_R = 30;
const CENTER = 40;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;
const SWEEP = SEG_ARC_SWEEP_DEG / 360;
const trackDash = `${CIRCUMFERENCE * SWEEP} ${CIRCUMFERENCE}`;
// The track circle is drawn from its 0° in the SVG frame, so rotate the <g>
// to put the arc's leading edge (value 0) at SEG_ARC_START_DEG.
const ARC_ROTATION = SEG_ARC_START_DEG;

// A stop's point on the arc — uses the shared segStopAngle so ticks and
// handle land exactly on the boundaries the click logic selects.
function pointAt(value: number) {
  const angle = (segStopAngle(value) * Math.PI) / 180;
  return { x: CENTER + GAUGE_R * Math.cos(angle), y: CENTER + GAUGE_R * Math.sin(angle) };
}

const gauges = computed(() =>
  (
    [
      ["humor", "HUMOR", "var(--cyan)"],
      ["honesty", "HONESTY", "var(--green)"],
      ["brevity", "BREVITY", "var(--amber)"],
      ["chatty", "CHATTY", "var(--violet)"],
    ] as const
  ).map(([key, label, color]) => {
    const value = shown.value[key];
    return {
      key: key as Trait,
      label,
      value,
      word: traitWord(key, value),
      color,
      dash: `${(CIRCUMFERENCE * SWEEP * value) / 100} ${CIRCUMFERENCE}`,
      handle: pointAt(value),
      ticks: TRAIT_STOPS.map((s) => ({ s, ...pointAt(s) })),
    };
  }),
);

const speedFraction = computed(() => Math.max(0, Math.min(1, (shown.value.speed - 0.7) / 0.8)));
const speedDash = computed(() => {
  const c = 2 * Math.PI * 24;
  return `${(c * 250 * speedFraction.value) / 360} ${c}`;
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
  preview.value = { ...preview.value, [trait]: segTraitFromAngle(angleFromEvent(event)) };
}
function traitMove(trait: Trait, event: PointerEvent) {
  if (event.buttons & 1) {
    preview.value = { ...preview.value, [trait]: segTraitFromAngle(angleFromEvent(event)) };
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
          <!-- the two arcs are drawn from the SVG's 0° and rotated to the
               arc's leading edge; ticks + handle use absolute points. -->
          <g :transform="`rotate(${ARC_ROTATION} 40 40)`">
            <circle
              cx="40" cy="40" :r="GAUGE_R" fill="none"
              stroke="color-mix(in srgb, var(--violet) 12%, transparent)"
              stroke-width="5" :stroke-dasharray="trackDash" stroke-linecap="round"
            />
            <circle
              cx="40" cy="40" :r="GAUGE_R" fill="none" :stroke="g.color" stroke-width="5"
              :stroke-dasharray="g.dash" stroke-linecap="round"
              :style="{ filter: `drop-shadow(0 0 4px ${g.color})` }"
            />
          </g>
          <!-- stop ticks: the 6 boundaries where the value can land -->
          <circle
            v-for="t in g.ticks" :key="t.s" :cx="t.x" :cy="t.y" r="1.7"
            :fill="t.s <= g.value ? 'var(--panel-solid)' : 'color-mix(in srgb, var(--cyan) 55%, transparent)'"
            :stroke="t.s <= g.value ? g.color : 'none'" stroke-width="1"
          />
          <!-- the handle: says 'grab me' -->
          <circle :cx="g.handle.x" :cy="g.handle.y" r="4.2" :fill="g.color"
                  stroke="var(--panel-solid)" stroke-width="1.5"
                  :style="{ filter: `drop-shadow(0 0 5px ${g.color})` }" />
        </svg>
        <span class="gv">{{ g.value }}</span>
        <div class="gl">{{ g.label }}</div>
        <div class="gw" :style="{ color: g.color }">{{ g.word }}</div>
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
.dial { cursor: pointer; touch-action: none; }
.gauge .gv {
  position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%);
  font-size: 14px; color: var(--cyan-hi); text-shadow: var(--glow-cyan);
  pointer-events: none;
}
.gauge .gl {
  font-size: 11px; letter-spacing: 0.12em; color: var(--cyan-hi);
  margin-top: 4px; font-weight: 600;
}
.gauge .gw { font-size: 10.5px; letter-spacing: 0.02em; margin-top: 2px; min-height: 13px; }

.charline { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.charline .lbl { font-size: 9px; letter-spacing: 0.22em; color: var(--muted); width: 78px; flex: none; }

.speeddial { flex: 1; display: flex; align-items: center; gap: 12px; }
.speeddial svg { width: 58px; flex: none; }
.speeddial .sv { font-size: 16px; color: var(--amber); text-shadow: var(--glow-amber); }
.speeddial .sr { font-size: 8.5px; color: var(--muted); letter-spacing: 0.12em; margin-top: 2px; }
</style>
