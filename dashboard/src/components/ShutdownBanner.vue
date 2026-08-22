<script setup lang="ts">
/** Graceful-shutdown countdown (#35) - five candidate looks, picked in
 * Storybook before wiring. Presentational only: countdown text comes in
 * via props, clicks bubble up. */
withDefaults(
  defineProps<{
    label: string; // "4:52" or "19s"
    variant?: "strip" | "hud" | "hazard" | "card" | "glow";
  }>(),
  { variant: "hud" },
);
defineEmits<{ restartNow: []; cancel: [] }>();
</script>

<template>
  <div class="sb" :class="`v-${variant}`">
    <span class="icon">⚠</span>
    <span class="msg">
      <b>DAEMON RESTART IN {{ label }}</b>
      <i>mid-sentence speech is safe — it waits for you</i>
    </span>
    <span class="count">{{ label }}</span>
    <span class="actions">
      <button class="act now" @click="$emit('restartNow')">RESTART NOW</button>
      <button class="act" @click="$emit('cancel')">CANCEL</button>
    </span>
  </div>
</template>

<style scoped>
.sb { display: flex; align-items: center; gap: 18px; font-family: var(--mono); }
.msg { display: flex; flex-direction: column; gap: 2px; }
.msg b { letter-spacing: 0.14em; }
.msg i { font-style: normal; font-size: 10px; letter-spacing: 0.08em; opacity: 0.75; }
.actions { margin-left: auto; display: flex; gap: 10px; }
.act {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
  background: none; padding: 6px 14px; cursor: pointer; border: 1px solid;
}
.count { display: none; font-variant-numeric: tabular-nums; }

/* A. STRIP - full-width slim service bar, calm and corporate. */
.v-strip {
  background: var(--red); color: #fff; padding: 8px 18px; font-size: 12px;
}
.v-strip .act { color: #fff; border-color: rgba(255, 255, 255, 0.7); }
.v-strip .act:hover { background: rgba(255, 255, 255, 0.15); }
.v-strip .msg i { color: rgba(255, 255, 255, 0.8); }

/* B. HUD - dark panel, red left edge, fits the console aesthetic. */
.v-hud {
  background: rgba(20, 6, 10, 0.92); border: 1px solid rgba(255, 95, 107, 0.5);
  border-left: 4px solid var(--red); color: var(--red);
  padding: 12px 18px; font-size: 12px;
}
.v-hud .icon { animation: sb-pulse 1.1s ease-in-out infinite; }
.v-hud .act { color: var(--red); border-color: rgba(255, 95, 107, 0.5); }
.v-hud .act:hover { border-color: var(--red); text-shadow: 0 0 6px rgba(255, 95, 107, 0.6); }

/* C. HAZARD - industrial tape border, dark core. */
.v-hazard {
  border: 6px solid; padding: 10px 16px; font-size: 12px;
  border-image: repeating-linear-gradient(45deg, #ffb454, #ffb454 10px, #10040a 10px, #10040a 20px) 6;
  background: #10040a; color: var(--amber);
}
.v-hazard .act { color: var(--amber); border-color: rgba(255, 180, 84, 0.6); }
.v-hazard .act.now { color: var(--red); border-color: rgba(255, 95, 107, 0.6); }

/* D. CARD - centered, the countdown is the hero. */
.v-card {
  flex-direction: column; gap: 8px; text-align: center;
  background: rgba(20, 6, 10, 0.95); border: 1px solid rgba(255, 95, 107, 0.4);
  padding: 18px 26px; font-size: 11px; color: var(--red);
}
.v-card .count { display: block; font-size: 44px; font-weight: 800; line-height: 1; }
.v-card .icon { display: none; }
.v-card .actions { margin: 6px 0 0; }
.v-card .act { color: var(--red); border-color: rgba(255, 95, 107, 0.5); }

/* E. GLOW - transparent, just glowing type; quietest of the five. */
.v-glow { background: none; color: var(--red); font-size: 13px; padding: 6px 0; }
.v-glow .msg b { text-shadow: 0 0 12px rgba(255, 95, 107, 0.8); }
.v-glow .icon { animation: sb-pulse 1.1s ease-in-out infinite; }
.v-glow .act { color: var(--red); border-color: rgba(255, 95, 107, 0.4); }

@keyframes sb-pulse { 50% { opacity: 0.35; } }
</style>
