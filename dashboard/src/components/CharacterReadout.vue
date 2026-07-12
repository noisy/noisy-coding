<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Character } from "../types";
import { pointerAngleDeg, speedFromAngle, traitValueFromAngle, VOICES } from "./characterMath";

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
      ["honesty", "HONESTY", "dipl ↔ blunt", "#3fd8ff"],
      ["brevity", "BREVITY", "detail ↔ terse", "#ffb454"],
      ["chatty", "CHATTY", "rare ↔ frequent", "#b98cff"],
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

const voiceGridOpen = ref(false);
function pickVoice(name: string) {
  voiceGridOpen.value = false;
  preview.value = { ...preview.value, voice: name };
  emit("change", { voice: name });
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
            <circle cx="40" cy="40" :r="GAUGE_R" fill="none" stroke="rgba(63,216,255,0.12)"
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
      <span class="lbl">VOICE</span>
      <div class="voicecur" @click="voiceGridOpen = !voiceGridOpen">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#3fd8ff" stroke-width="1" />
          <circle cx="7" cy="7" r="2" fill="#3fd8ff" />
        </svg>
        <span class="vname">{{ shown.voice.toUpperCase() }}</span>
        <span class="vg">{{ (VOICES[shown.voice] ?? "").toUpperCase() }}</span>
        <span class="arrow">{{ voiceGridOpen ? "▴" : "▾" }}</span>
      </div>
    </div>
    <div v-if="voiceGridOpen" class="voicegrid">
      <b
        v-for="(gender, name) in VOICES"
        :key="name"
        :class="{ sel: name === shown.voice }"
        :title="gender"
        @click="pickVoice(name)"
      >{{ name.toUpperCase() }}</b>
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
          <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(63,216,255,0.15)" stroke-width="4" />
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

.voicecur {
  flex: 1; display: flex; align-items: center; gap: 10px;
  border: 1px solid var(--line-strong); padding: 7px 12px;
  background: rgba(63, 216, 255, 0.06); cursor: pointer;
  clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px);
}
.voicecur .vname { font-size: 13px; letter-spacing: 0.2em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); }
.voicecur .vg { font-size: 9px; color: var(--muted); letter-spacing: 0.1em; }
.voicecur .arrow { margin-left: auto; color: var(--cyan-dim); font-size: 10px; }

.voicegrid { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.voicegrid b {
  font-weight: 400; font-size: 9px; letter-spacing: 0.12em; color: var(--muted);
  border: 1px solid rgba(63, 216, 255, 0.15); padding: 3px 8px; cursor: pointer;
  clip-path: polygon(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px);
}
.voicegrid b:hover { color: var(--cyan); border-color: var(--cyan-dim); }
.voicegrid b.sel {
  color: var(--cyan-hi); border-color: var(--cyan);
  background: rgba(63, 216, 255, 0.12); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6);
}

.speeddial { flex: 1; display: flex; align-items: center; gap: 12px; }
.speeddial svg { width: 58px; flex: none; }
.speeddial .sv { font-size: 16px; color: var(--amber); text-shadow: var(--glow-amber); }
.speeddial .sr { font-size: 8.5px; color: var(--muted); letter-spacing: 0.12em; margin-top: 2px; }
</style>
