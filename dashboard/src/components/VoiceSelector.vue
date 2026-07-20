<script setup lang="ts">
import { ref } from "vue";
import { VOICES } from "./characterMath";

// The voice picker, extracted from CharacterReadout: a collapsed current
// pick that unfolds into the full voice grid. Emits the new voice name;
// persisting it is the parent's business.
const props = defineProps<{ voice: string }>();
const emit = defineEmits<{ change: [voice: string] }>();

const open = ref(false);
function pick(name: string) {
  open.value = false;
  if (name !== props.voice) emit("change", name);
}
</script>

<template>
  <!-- The unfolded grid OVERLAYS whatever sits below (z-axis) instead of
       pushing it down — the rail's height must not jump. -->
  <div class="voiceselector">
    <div class="voicecur" @click="open = !open">
      <span class="lbl">VOICE</span>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="#3fd8ff" stroke-width="1" />
        <circle cx="7" cy="7" r="2" fill="#3fd8ff" />
      </svg>
      <span class="vname">{{ voice.toUpperCase() || "—" }}</span>
      <span class="vg">{{ (VOICES[voice] ?? "").toUpperCase() }}</span>
      <span class="arrow">{{ open ? "▴" : "▾" }}</span>
    </div>
    <div v-if="open" class="voicegrid">
      <b
        v-for="(gender, name) in VOICES"
        :key="name"
        :class="{ sel: name === voice }"
        :title="gender"
        @click="pick(name)"
      >{{ name.toUpperCase() }}</b>
    </div>
  </div>
</template>

<style scoped>
.voiceselector { position: relative; }
.voicecur {
  display: flex; align-items: center; gap: 10px;
  border: 1px solid var(--line-strong); padding: 7px 12px;
  background: rgba(63, 216, 255, 0.06); cursor: pointer;
  clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px);
}
.voicecur .lbl { font-size: 9px; letter-spacing: 0.22em; color: var(--muted); }
.voicecur .vname { font-size: 13px; letter-spacing: 0.2em; color: var(--cyan-hi); text-shadow: var(--glow-cyan); }
.voicecur .vg { font-size: 9px; color: var(--muted); letter-spacing: 0.1em; }
.voicecur .arrow { margin-left: auto; color: var(--cyan-dim); font-size: 10px; }

.voicegrid {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 10px;
  background: var(--panel-solid, #071626);
  border: 1px solid var(--line-strong);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
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
</style>
