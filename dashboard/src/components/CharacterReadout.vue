<script setup lang="ts">
/** The character-matrix editor: four TraitDial controls (humor, honesty,
 * brevity, chatty) plus a speech-rate dial.
 *
 * Each trait is one small TraitDial given a value, its label, its semantic
 * word, and an EXPLICIT colour. Humor's colour is a literal blue, not
 * var(--cyan): this component renders inside the persona rail, which recolors
 * --cyan → --violet, and that override used to turn humor violet. The other
 * three already used their own vars, so only humor needed pinning.
 */
import { computed, ref, watch } from "vue";
import type { Character } from "../types";
import TraitDial from "./TraitDial.vue";
import { pointerAngleDeg, speedFromAngle, traitWord } from "./characterMath";

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

// Per-trait colour is declared HERE (the parent), passed down explicitly.
// #3fd8ff is --cyan's literal value — pinned so the rail's cyan→violet
// recolor leaves humor blue.
const TRAITS: { key: Trait; label: string; color: string }[] = [
  { key: "humor", label: "HUMOR", color: "#3fd8ff" },
  { key: "honesty", label: "HONESTY", color: "var(--green)" },
  { key: "brevity", label: "BREVITY", color: "var(--amber)" },
  { key: "chatty", label: "CHATTY", color: "var(--violet)" },
];

const dials = computed(() =>
  TRAITS.map((t) => ({ ...t, value: shown.value[t.key], word: traitWord(t.key, shown.value[t.key]) })),
);

function setTrait(trait: Trait, value: number) {
  preview.value = { ...preview.value, [trait]: value };
}
function commitTrait(trait: Trait) {
  const value = preview.value[trait];
  if (value != null) emit("change", { [trait]: value });
}

// Speech-rate keeps its own continuous dial (0.05 steps).
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
      <TraitDial
        v-for="d in dials"
        :key="d.key"
        :value="d.value"
        :label="d.label"
        :word="d.word"
        :color="d.color"
        @input="setTrait(d.key, $event)"
        @commit="commitTrait(d.key)"
      />
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
          <circle cx="30" cy="30" r="24" fill="none" stroke="color-mix(in srgb, var(--amber) 15%, transparent)" stroke-width="4" />
          <circle cx="30" cy="30" r="24" fill="none" stroke="var(--amber)" stroke-width="4"
                  :stroke-dasharray="speedDash" stroke-linecap="round"
                  transform="rotate(-215 30 30)"
                  style="filter: drop-shadow(0 0 4px rgba(255, 180, 84, 0.7))" />
          <circle cx="30" cy="30" r="2.5" fill="var(--amber)" />
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
.dial { cursor: pointer; touch-action: none; }

.charline { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.charline .lbl { font-size: 9px; letter-spacing: 0.22em; color: var(--muted); width: 78px; flex: none; }

.speeddial { flex: 1; display: flex; align-items: center; gap: 12px; }
.speeddial svg { width: 58px; flex: none; }
.speeddial .sv { font-size: 16px; color: var(--amber); text-shadow: var(--glow-amber); }
.speeddial .sr { font-size: 8.5px; color: var(--muted); letter-spacing: 0.12em; margin-top: 2px; }
</style>
