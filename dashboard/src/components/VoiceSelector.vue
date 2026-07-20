<script setup lang="ts">
import { ref } from "vue";
import { VOICES } from "./characterMath";
import { voiceSpriteStyle } from "./voiceSprites";

// The voice picker: a collapsed current pick that unfolds into a
// scrollable list (portrait thumb left, name right). Emits the new voice
// name; persisting it is the parent's business.
const props = defineProps<{ voice: string }>();
const emit = defineEmits<{ change: [voice: string] }>();

const open = ref(false);
function pick(name: string) {
  open.value = false;
  if (name !== props.voice) emit("change", name);
}
</script>

<template>
  <!-- The unfolded list OVERLAYS whatever sits below (z-axis) instead of
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
    <div v-if="open" class="voicelist">
      <div
        v-for="(gender, name) in VOICES"
        :key="name"
        class="row"
        :class="{ sel: name === voice }"
        :title="gender"
        @click="pick(name)"
      >
        <span v-if="voiceSpriteStyle(name)" class="thumb" :style="voiceSpriteStyle(name)!" />
        <span v-else class="thumb blank">{{ name[0].toUpperCase() }}</span>
        <span class="name">{{ name.toUpperCase() }}</span>
        <span class="gender">{{ gender.toUpperCase() }}</span>
      </div>
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

/* ~4 big rows visible (56px each), the rest behind a thin scrollbar. */
.voicelist {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 230px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
  background: var(--panel-solid, #071626);
  border: 1px solid var(--line-strong);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(63, 216, 255, 0.08);
}
.row:last-child { border-bottom: none; }
.row:hover { background: rgba(63, 216, 255, 0.08); }
.row.sel { background: rgba(63, 216, 255, 0.14); }
.row.sel .name { color: var(--cyan-hi); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6); }
.thumb {
  width: 44px;
  height: 44px;
  flex: none;
  border: 1px solid var(--line);
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
}
.thumb.blank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--cyan-dim);
}
.name { font-size: 12px; letter-spacing: 0.2em; color: var(--muted); }
.row:hover .name { color: var(--cyan); }
.gender { margin-left: auto; font-size: 9px; letter-spacing: 0.14em; color: rgba(93, 127, 150, 0.7); }
</style>
