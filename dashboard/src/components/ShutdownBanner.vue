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
.sb { display:flex; flex-wrap:wrap; align-items:center; gap:10px; width:100%; padding:12px 16px; border:1px solid var(--amber-dim); border-radius:10px; background:#302a22; color:var(--amber); }
.col-count { display:flex; align-items:center; gap:16px; margin-right:auto; }
.msg { display:flex; flex-direction:column; font-size:12px; }
.msg i { font-size:11px; font-style:normal; color:var(--muted); }
.count { font:600 22px var(--mono); }
.act { padding:9px 14px; background:var(--panel); color:var(--ink); border:1px solid var(--line-strong); font-size:12px; }
.act:hover { border-color:var(--amber); }
.act.cancel { background:var(--amber); color:var(--bg0); border-color:var(--amber); }
.dots i { font-style:normal; }
</style>
