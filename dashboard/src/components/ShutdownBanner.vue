<script setup lang="ts">
/** Graceful-shutdown countdown (#35) - five candidate looks, picked in
 * Storybook before wiring. Presentational plus ONE bit of local state:
 * clicking RESTART NOW must acknowledge the click instantly (the actual
 * restart takes seconds, and a silent button reads as a dead button). */
import { ref } from "vue";

withDefaults(
  defineProps<{
    label: string; // "4:52" or "19s"
    /** D5: full-width top-of-page bar, three columns - countdown |
     * restart-now | a big amber CANCEL filling the rest. */
    variant?: "card-d5";
  }>(),
  { variant: "card-d5" },
);
const emit = defineEmits<{ restartNow: []; cancel: []; postpone: [] }>();

const restarting = ref(false);
function restartNow() {
  if (restarting.value) return; // one restart is plenty
  restarting.value = true;
  emit("restartNow");
}
</script>

<template>
  <div class="sb" :class="`v-${variant}`">
    <div class="col-count">
      <span class="msg">
        <b>DAEMON RESTART</b>
        <i>speech is safe — it waits</i>
      </span>
      <span class="count">{{ label }}</span>
    </div>
    <button class="act now" :class="{ restarting }" :disabled="restarting" @click="restartNow">
      {{ restarting ? "RESTARTING" : "restart now" }}<span v-if="restarting" class="dots"><i>.</i><i>.</i><i>.</i></span>
    </button>
    <button class="act now postpone" :disabled="restarting" @click="$emit('postpone')">+1 min</button>
    <button class="act cancel" :disabled="restarting" @click="$emit('cancel')">✕ CANCEL</button>
  </div>
</template>

<style scoped>
/* D5: page-top bar, three columns left to right:
   [ countdown ] [ restart now ] [ CANCEL - amber, eats the rest ] */
.sb {
  display: flex; gap: 16px; align-items: stretch; font-family: var(--mono);
  width: 100%;
  background: rgba(20, 6, 10, 0.95); border: 1px solid rgba(255, 95, 107, 0.4);
  padding: 12px 16px; color: var(--red);
}
.col-count { flex: none; display: flex; flex-direction: column; gap: 2px; text-align: center; padding: 0 8px; }
.msg { display: flex; flex-direction: column; gap: 1px; }
.msg b { font-size: 10px; letter-spacing: 0.16em; }
.msg i { font-style: normal; font-size: 8px; letter-spacing: 0.08em; opacity: 0.75; }
.count {
  font-size: 44px; font-weight: 800; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.act { font-family: var(--mono); letter-spacing: 0.14em; cursor: pointer; }
.act.now {
  flex: none; width: 330px; align-self: stretch;
  font-size: 15px; line-height: 1.6; background: none;
  color: var(--red); border: 1px solid rgba(255, 95, 107, 0.4);
}
.act.now:hover { border-color: var(--red); }
/* Clicked: unmistakable acknowledgement - solid fill, animated ellipsis,
   and every button (this one included) stops taking further clicks. */
.act.now.restarting {
  background: var(--red); color: #1a0508; font-weight: 800;
  border-color: var(--red); cursor: default;
}
.act:disabled { opacity: 0.45; cursor: default; }
.act.now.restarting:disabled { opacity: 1; }
.dots i { animation: dot-blink 1.2s infinite; }
.dots i:nth-child(2) { animation-delay: 0.2s; }
.dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-blink { 0%, 60% { opacity: 1; } 80%, 100% { opacity: 0.15; } }
.act.postpone { width: 150px; color: var(--cyan-dim); border-color: rgba(63, 216, 255, 0.35); }
.act.postpone:hover { color: var(--cyan-hi); border-color: var(--cyan); }
.act.cancel {
  flex: 1; align-self: stretch; border: none;
  font-size: 24px; font-weight: 800; letter-spacing: 0.24em;
  color: #10040a; background: var(--amber);
  box-shadow: 0 0 18px rgba(255, 180, 84, 0.5);
}
.act.cancel:hover { filter: brightness(1.12); }
</style>
