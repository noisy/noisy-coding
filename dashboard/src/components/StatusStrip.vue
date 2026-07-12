<script setup lang="ts">
import { computed } from "vue";
import type { DaemonStatus } from "../types";
import { stateLabel } from "./systemState";

const props = defineProps<{
  status: DaemonStatus | null;
  offline: boolean;
}>();

const state = computed(() => stateLabel(props.status, props.offline));
const costs = computed(() => props.status?.session_cost_usd ?? { user: 0, claude: 0 });
const total = computed(() => costs.value.user + costs.value.claude);

const FUEL_CELLS = 20;
const FUEL_FULL_USD = 5;
const fuelOn = computed(() => {
  const credits = props.status?.credits_usd;
  if (credits == null) return 0;
  return Math.round(Math.min(1, credits / FUEL_FULL_USD) * FUEL_CELLS);
});
</script>

<template>
  <div class="strip">
    <div class="bigstate">
      <div class="ringwrap" :class="state.tone">
        <div class="orbit" />
        <div class="core" />
      </div>
      <div>
        <div class="label" :class="state.tone">{{ state.label }}</div>
        <div class="det">{{ state.detail }}</div>
      </div>
    </div>

    <div class="costs">
      <div class="total">${{ total.toFixed(4) }}</div>
      <div class="split">
        <span class="you-c"><small>YOU · STT</small>${{ costs.user.toFixed(4) }}</span>
        <span class="cl-c"><small>CLAUDE · TTS</small>${{ costs.claude.toFixed(4) }}</span>
      </div>
    </div>

    <div v-if="status?.credits_usd != null" class="fuel">
      <div class="frow">
        <span>CREDITS REMAINING</span>
        <b>${{ status.credits_usd.toFixed(2) }}</b>
      </div>
      <div class="fuelbar">
        <i v-for="n in FUEL_CELLS" :key="n" :class="{ off: n > fuelOn }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.strip { display: grid; gap: 14px; }
.bigstate { display: flex; align-items: center; gap: 12px; }
.ringwrap { position: relative; width: 34px; height: 34px; }
.ringwrap .core {
  position: absolute; inset: 11px; border-radius: 50%;
  background: var(--cyan); box-shadow: 0 0 10px var(--cyan), 0 0 26px rgba(63, 216, 255, 0.6);
  animation: corepulse 2.2s ease-in-out infinite;
}
.ringwrap .orbit {
  position: absolute; inset: 0; border-radius: 50%;
  border: 1px solid var(--cyan-dim); border-top-color: var(--cyan);
  animation: spin 3.2s linear infinite;
}
.ringwrap.warn .core { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
.ringwrap.off .core { background: var(--red); box-shadow: 0 0 10px var(--red); animation: none; }
.ringwrap.off .orbit { animation: none; border-color: rgba(255, 95, 107, 0.4); }
.label { font-size: 15px; letter-spacing: 0.22em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); }
.label.warn { color: var(--amber); text-shadow: var(--glow-amber); }
.label.off { color: var(--red); text-shadow: 0 0 8px rgba(255, 95, 107, 0.6); }
.det { font-size: 10px; letter-spacing: 0.18em; color: var(--muted); margin-top: 3px; }
@keyframes corepulse { 50% { opacity: 0.45; transform: scale(0.82); } }
@keyframes spin { to { transform: rotate(360deg); } }

.costs { text-align: center; }
.total { font-size: 24px; color: var(--cyan-hi); text-shadow: var(--glow-cyan); letter-spacing: 0.08em; }
.split { display: flex; justify-content: space-around; font-size: 10px; letter-spacing: 0.1em; margin-top: 8px; }
.split .you-c { color: var(--amber); }
.split .cl-c { color: var(--violet); }
.split small { color: var(--muted); display: block; font-size: 8.5px; letter-spacing: 0.2em; margin-bottom: 3px; }

.fuel .frow { display: flex; justify-content: space-between; font-size: 9px; letter-spacing: 0.16em; color: var(--muted); margin-bottom: 5px; }
.fuel .frow b { color: var(--green); font-weight: 400; text-shadow: 0 0 8px rgba(77, 255, 180, 0.4); }
.fuelbar { height: 10px; border: 1px solid var(--line); padding: 1px; display: flex; gap: 2px; }
.fuelbar i { flex: 1; background: rgba(77, 255, 180, 0.75); box-shadow: 0 0 6px rgba(77, 255, 180, 0.5); }
.fuelbar i.off { background: rgba(63, 216, 255, 0.07); box-shadow: none; }
</style>
