<script setup lang="ts">
import { computed } from "vue";
import type { Character } from "../types";

const props = defineProps<{ character: Character }>();

const GAUGE_R = 30;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;
const SWEEP = 0.78; // 280° arc, like the prototype

export interface GaugeSpec {
  key: string;
  label: string;
  scale: string;
  value: number;
  color: string;
  dash: string;
}

const gauges = computed<GaugeSpec[]>(() =>
  (
    [
      ["humor", "HUMOR", "dry ↔ playful", "#3fd8ff"],
      ["honesty", "HONESTY", "dipl ↔ blunt", "#3fd8ff"],
      ["brevity", "BREVITY", "detail ↔ terse", "#ffb454"],
      ["chatty", "CHATTY", "rare ↔ frequent", "#b98cff"],
    ] as const
  ).map(([key, label, scale, color]) => {
    const value = props.character[key];
    return {
      key,
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
  // Dial sweep 250°, range 0.5–2.0×, radius 24 (prototype speed dial).
  const fraction = Math.max(0, Math.min(1, (props.character.speed - 0.5) / 1.5));
  const c = 2 * Math.PI * 24;
  return `${(c * 250 * fraction) / 360} ${c}`;
});
</script>

<template>
  <div>
    <div class="gauges">
      <div v-for="g in gauges" :key="g.key" class="gauge">
        <svg viewBox="0 0 80 80">
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
      <div class="voicecur">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="#3fd8ff" stroke-width="1" />
          <circle cx="7" cy="7" r="2" fill="#3fd8ff" />
        </svg>
        <span class="vname">{{ character.voice.toUpperCase() }}</span>
        <span class="vg">SET VIA DASHBOARD OR change_voice</span>
      </div>
    </div>

    <div class="charline">
      <span class="lbl">SPEECH RATE</span>
      <div class="speeddial">
        <svg viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(63,216,255,0.15)" stroke-width="4" />
          <circle cx="30" cy="30" r="24" fill="none" stroke="#ffb454" stroke-width="4"
                  :stroke-dasharray="speedDash" stroke-linecap="round"
                  transform="rotate(-215 30 30)"
                  style="filter: drop-shadow(0 0 4px rgba(255, 180, 84, 0.7))" />
          <circle cx="30" cy="30" r="2.5" fill="#ffb454" />
        </svg>
        <div>
          <div class="sv">{{ character.speed.toFixed(2) }}×</div>
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
.gauge .gv {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -66%);
  font-size: 13px; color: var(--cyan-hi); text-shadow: var(--glow-cyan);
}
.gauge .gl { font-size: 8.5px; letter-spacing: 0.18em; color: var(--muted); margin-top: 2px; }
.gauge .gs { font-size: 7.5px; letter-spacing: 0.06em; color: rgba(93, 127, 150, 0.7); margin-top: 2px; }

.charline { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.charline .lbl { font-size: 9px; letter-spacing: 0.22em; color: var(--muted); width: 78px; flex: none; }

.voicecur {
  flex: 1; display: flex; align-items: center; gap: 10px;
  border: 1px solid var(--line-strong); padding: 7px 12px;
  background: rgba(63, 216, 255, 0.06);
  clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px);
}
.voicecur .vname { font-size: 13px; letter-spacing: 0.2em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); }
.voicecur .vg { font-size: 8px; color: var(--muted); letter-spacing: 0.1em; margin-left: auto; }

.speeddial { flex: 1; display: flex; align-items: center; gap: 12px; }
.speeddial svg { width: 58px; flex: none; }
.speeddial .sv { font-size: 16px; color: var(--amber); text-shadow: var(--glow-amber); }
.speeddial .sr { font-size: 8.5px; color: var(--muted); letter-spacing: 0.12em; margin-top: 2px; }
</style>
