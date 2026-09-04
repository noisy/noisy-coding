<script setup lang="ts">
/** "Set the humor to 75%" - the character-settings section.
 *
 * Composes the REAL dashboard components (CharacterReadout, VoicePersona)
 * the same way DashboardMock does; nothing is reimplemented. Every few
 * seconds the dials ease to the next preset to show that switching an
 * agent's whole personality is one click. Reduced motion pins the first
 * preset and never animates.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import CharacterReadout from "@dashboard/components/CharacterReadout.vue";
import VoicePersona from "@dashboard/components/VoicePersona.vue";
import type { Character } from "@dashboard/types";

interface Preset {
  name: string;
  line: string;
  character: Character;
}

const PRESETS: Preset[] = [
  {
    name: "THE COLLEAGUE",
    line: "Straight answers, a joke when it earns one.",
    character: { humor: 75, honesty: 80, brevity: 60, chatty: 40, voice: "lux", speed: 1.05 },
  },
  {
    name: "THE DEADPAN BUTLER",
    line: "Dry. Precise. Faintly unimpressed by your code.",
    character: { humor: 20, honesty: 100, brevity: 80, chatty: 10, voice: "atlas", speed: 0.9 },
  },
  {
    name: "THE HYPE GREMLIN",
    line: "Every green test is a personal victory.",
    character: { humor: 90, honesty: 60, brevity: 20, chatty: 90, voice: "cosmo", speed: 1.35 },
  },
  {
    name: "MISSION CONTROL",
    line: "Facts only. Zero banter. Go for launch.",
    character: { humor: 0, honesty: 100, brevity: 100, chatty: 0, voice: "orion", speed: 1.0 },
  },
];

const HOLD_MS = 3800;
const TWEEN_MS = 800;
const RESUME_AFTER_MS = 15000;

const presetIndex = ref(0);
const character = ref<Character>({ ...PRESETS[0].character });
const preset = computed(() => PRESETS[presetIndex.value]);

let holdTimer: number | undefined;
let raf: number | undefined;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function tweenTo(target: Character) {
  const from = { ...character.value };
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / TWEEN_MS);
    const k = easeInOut(t);
    character.value = {
      humor: Math.round(from.humor + (target.humor - from.humor) * k),
      honesty: Math.round(from.honesty + (target.honesty - from.honesty) * k),
      brevity: Math.round(from.brevity + (target.brevity - from.brevity) * k),
      chatty: Math.round(from.chatty + (target.chatty - from.chatty) * k),
      speed: from.speed + (target.speed - from.speed) * k,
      voice: k > 0.5 ? target.voice : from.voice,
    };
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

let resumeTimer: number | undefined;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function startAutoAdvance() {
  if (reducedMotion() || holdTimer) return;
  holdTimer = window.setInterval(() => {
    presetIndex.value = (presetIndex.value + 1) % PRESETS.length;
    tweenTo(PRESETS[presetIndex.value].character);
  }, HOLD_MS);
}
function stopAutoAdvance() {
  if (holdTimer) window.clearInterval(holdTimer);
  holdTimer = undefined;
}

/** A click picks a character by hand: tween there (or snap, under reduced
 *  motion), park the carousel, and only resume after 15s of no clicks. */
function pickPreset(i: number) {
  stopAutoAdvance();
  if (resumeTimer) window.clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(startAutoAdvance, RESUME_AFTER_MS);
  if (i === presetIndex.value) return;
  presetIndex.value = i;
  if (raf) cancelAnimationFrame(raf);
  if (reducedMotion()) character.value = { ...PRESETS[i].character };
  else tweenTo(PRESETS[i].character);
}

/** Arrow keys walk the preset list and select as they go. */
function listKeydown(event: KeyboardEvent) {
  const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1
    : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
  if (!delta) return;
  event.preventDefault();
  const next = (presetIndex.value + delta + PRESETS.length) % PRESETS.length;
  pickPreset(next);
  const rows = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(".preset-row");
  rows[next]?.focus();
}

onMounted(startAutoAdvance);
onBeforeUnmount(() => {
  stopAutoAdvance();
  if (resumeTimer) window.clearTimeout(resumeTimer);
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <section id="character" class="charsec">
    <div class="wrap">
      <div class="label"><span class="idx">01.5</span>PERSONALITY MATRIX</div>
      <h2>Set the humor to 75%</h2>
      <div class="char-cols">
        <div class="char-copy">
          <p class="char-lead">
            Every agent has character dials - <b>HUMOR</b>, <b>HONESTY</b>,
            <b>BREVITY</b>, <b>CHATTY</b> - plus speech rate and one of 34 voice
            personas with avatar portraits. Your reviewer can be a deadpan
            butler while your test runner is pure hype. One click per agent,
            right from the dashboard.
          </p>
          <p class="char-nod">
            Everyone's favorite movie robot taught us this: the right humor
            setting is adjustable.
          </p>
          <div class="preset-list" role="group" aria-label="Character presets" @keydown="listKeydown">
            <button
              v-for="(p, i) in PRESETS"
              :key="p.name"
              type="button"
              class="preset-row"
              :class="{ on: i === presetIndex }"
              :aria-pressed="i === presetIndex"
              @click="pickPreset(i)"
            >
              <span class="preset-name">{{ p.name }}</span>
              <span class="preset-line">{{ p.line }}</span>
            </button>
          </div>
        </div>
        <div class="char-rail">
          <div class="rail-head">
            <span>AGENT CHARACTER // {{ preset.name }}</span>
            <span class="live">&#9679; LIVE</span>
          </div>
          <div class="rail-body">
            <div class="railbox persona-box">
              <!-- All four portraits stay rendered and painted (stacked in
                   one grid cell, opacity-toggled): the 9MB avatars sprite
                   decodes once at mount, so a preset switch never waits on
                   an image decode. -->
              <div class="persona-stack">
                <div
                  v-for="(p, i) in PRESETS"
                  :key="p.character.voice"
                  class="persona-layer"
                  :class="{ show: i === presetIndex }"
                >
                  <VoicePersona :voice="p.character.voice" :speaking="false" :muted="false" />
                </div>
              </div>
            </div>
            <div class="railbox">
              <div class="railtitle">CHARACTER SETTINGS</div>
              <CharacterReadout :character="character" />
            </div>
          </div>
        </div>
      </div>
      <p class="shot-caption">The real dashboard panel, live - dials snap to a new personality the moment you pick one.</p>
    </div>
  </section>
</template>

<style scoped>
/* The dashboard components read hud.css tokens the site does not define
   globally; scope them to this section (values copied from hud.css). */
.charsec {
  --panel-solid: #071626;
  --line: rgba(64, 200, 255, 0.22);
  --line-strong: rgba(64, 200, 255, 0.55);
  --cyan-hi: #9aeeff;
  --violet: #b98cff;
  --violet-hi: #d9c2ff;
  --violet-dim: rgba(185, 140, 255, 0.45);
  --green: #4dffb4;
  --ink: #cfeaf6;
  --glow-amber: 0 0 6px rgba(255, 180, 84, 0.9), 0 0 18px rgba(255, 180, 84, 0.3);
  --glow-violet: 0 0 6px rgba(185, 140, 255, 0.9), 0 0 18px rgba(185, 140, 255, 0.35);
}

.char-cols {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 36px;
  align-items: start;
}

.char-lead { max-width: 560px; }
.char-lead b { color: var(--cyan); font-weight: 700; }
.char-nod { margin-top: 14px; color: var(--muted); font-style: italic; max-width: 560px; }

.preset-list { margin-top: 26px; display: flex; flex-direction: column; gap: 8px; }
.preset-row {
  display: flex; align-items: baseline; gap: 14px;
  padding: 8px 12px;
  border: 1px solid transparent;
  transition: border-color 0.4s, background 0.4s;
  /* Button reset - the rows are real buttons for keyboard users. */
  font: inherit; font-family: var(--mono);
  background: none; color: inherit;
  text-align: left; width: 100%; cursor: pointer;
}
.preset-row:hover:not(.on) {
  border-color: var(--cyan-faint);
  background: rgba(63, 216, 255, 0.05);
}
.preset-row:hover:not(.on) .preset-name { color: var(--cyan); }
.preset-row:focus-visible {
  outline: 1px solid var(--cyan);
  outline-offset: 2px;
}
.preset-row.on {
  border-color: var(--violet-dim);
  background: color-mix(in srgb, var(--violet) 7%, transparent);
}
.preset-name {
  font-size: 11px; letter-spacing: 0.22em; color: var(--muted);
  width: 190px; flex: none;
}
.preset-row.on .preset-name { color: var(--violet-hi); text-shadow: var(--glow-violet); }
.preset-line { font-size: 12px; color: var(--muted); }
.preset-row.on .preset-line { color: var(--text); }

.char-rail {
  border: 1px solid var(--line-strong);
  background: #03090f;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
}
.rail-head {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 9px; letter-spacing: 0.24em; color: var(--violet-dim);
}
.rail-head .live { color: var(--amber); flex: none; }
.rail-body {
  padding: 16px;
  display: flex; flex-direction: column; gap: 14px;
  background: color-mix(in srgb, var(--violet) 5%, transparent);
  --cyan: var(--violet);
  --cyan-hi: var(--violet-hi);
  --cyan-dim: var(--violet-dim);
  --glow-cyan: var(--glow-violet);
  --line: color-mix(in srgb, var(--violet) 22%, transparent);
  --line-strong: color-mix(in srgb, var(--violet) 55%, transparent);
}
.railbox { border-bottom: 1px solid var(--line); padding-bottom: 14px; }
.railbox:last-child { border-bottom: none; padding-bottom: 0; }
.railtitle { font-size: 9px; letter-spacing: 0.26em; color: var(--muted); margin-bottom: 10px; }
.persona-stack { display: grid; }
.persona-layer {
  grid-area: 1 / 1;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.persona-layer.show { opacity: 1; pointer-events: auto; }
@media (prefers-reduced-motion: reduce) {
  .persona-layer { transition: none; }
}

/* Marketing prop, not the app: keep the persona's mute affordance quiet. */
.persona-box :deep(.mutebtn) { display: none; }
.persona-box :deep(.frame) { cursor: default; }

@media (max-width: 860px) {
  .char-cols { grid-template-columns: 1fr; }
  .char-rail { max-width: 360px; }
  .preset-name { width: auto; min-width: 150px; }
}
</style>
