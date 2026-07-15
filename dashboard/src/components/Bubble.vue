<script setup lang="ts">
import type { StatusKind } from "./bubbleStatus";

withDefaults(
  defineProps<{
    side: "left" | "right";
    accent: "amber" | "violet" | "cyan";
    who: string;
    text: string;
    statusKind: StatusKind;
    statusLabel: string;
    time: string;
    cost?: string;
    detail?: string;
    live?: boolean;
    pending?: boolean;
    replayable?: boolean;
    cancelable?: boolean;
    playing?: boolean;
  }>(),
  {
    cost: "—",
    detail: "",
    live: false,
    pending: false,
    replayable: false,
    cancelable: false,
    playing: false,
  },
);

defineEmits<{ replay: []; cancel: [] }>();
</script>

<template>
  <div class="msg" :class="[`side-${side}`, `accent-${accent}`]">
    <div class="mhead">
      <span class="who">{{ who }}</span>
      <span class="st" :class="statusKind">{{ statusLabel }}</span>
      <button
        v-if="replayable || playing"
        class="replay"
        :class="{ playing }"
        :title="playing ? 'Stop playback' : 'Play this message again'"
        @click="$emit('replay')"
      >{{ playing ? "⏹" : "↻ ▶" }}</button>
      <button
        v-if="cancelable"
        class="cancel"
        title="Recall this message before Claude reads it"
        @click="$emit('cancel')"
      >✕</button>
      <span v-if="live" class="livebars"><i /><i /><i /><i /><i /></span>
      <span class="tm">{{ time }}</span>
    </div>
    <div class="txt" :class="{ pending }">{{ text }}<span v-if="live" class="caret" /></div>
    <div class="mfoot">
      <span>{{ detail }}</span>
      <span class="cost">{{ cost }}</span>
    </div>
  </div>
</template>

<style scoped>
.msg {
  position: relative;
  border: 1px solid var(--line);
  background: rgba(5, 14, 24, 0.85);
  padding: 10px 14px 9px;
  max-width: 88%;
}
.msg.accent-amber { --accent: var(--amber); --accent-tint: rgba(255, 180, 84, 0.07); }
.msg.accent-violet { --accent: var(--violet); --accent-tint: rgba(185, 140, 255, 0.07); }
.msg.accent-cyan { --accent: var(--cyan); --accent-tint: rgba(63, 216, 255, 0.07); }
/* A left-anchored bubble grows rightward as live transcription appends
   text — the natural reading direction. The accent edge sits on the
   outer side either way. */
.msg.side-left {
  align-self: flex-start;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
  border-left: 2px solid var(--accent);
  background: linear-gradient(90deg, var(--accent-tint), rgba(5, 14, 24, 0.85) 40%);
}
.msg.side-right {
  align-self: flex-end;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  border-right: 2px solid var(--accent);
  background: linear-gradient(270deg, var(--accent-tint), rgba(5, 14, 24, 0.85) 40%);
}
.mhead { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.who { font-size: 10px; letter-spacing: 0.26em; font-weight: 700; }
.accent-amber .who { color: var(--amber); text-shadow: var(--glow-amber); }
.accent-violet .who { color: var(--violet); text-shadow: 0 0 8px rgba(185, 140, 255, 0.5); }
.accent-cyan .who { color: var(--cyan); text-shadow: 0 0 8px rgba(63, 216, 255, 0.5); }
.st {
  font-size: 9px;
  letter-spacing: 0.16em;
  padding: 2px 9px;
  border: 1px solid;
  text-transform: uppercase;
}
.st.done { color: var(--green); border-color: rgba(77, 255, 180, 0.4); }
.st.work { color: var(--cyan); border-color: rgba(63, 216, 255, 0.4); }
.st.rec { color: var(--amber); border-color: rgba(255, 180, 84, 0.5); animation: blink 0.9s step-end infinite; }
.st.spoken { color: var(--violet); border-color: rgba(185, 140, 255, 0.45); }
.st.fail { color: var(--red); border-color: rgba(255, 95, 107, 0.45); }
.st.off { color: var(--muted); border-color: rgba(93, 127, 150, 0.4); }
@keyframes blink { 50% { opacity: 0.35; } }
.replay {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--cyan-dim);
  background: none;
  border: 1px solid rgba(63, 216, 255, 0.25);
  padding: 2px 8px;
  cursor: pointer;
}
.replay:hover { color: var(--cyan-hi); border-color: var(--cyan); text-shadow: 0 0 6px rgba(63, 216, 255, 0.6); }
.replay.playing { color: var(--amber); border-color: var(--amber-dim); text-shadow: var(--glow-amber); }
.cancel {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--muted);
  background: none;
  border: 1px solid rgba(93, 127, 150, 0.4);
  padding: 2px 7px;
  cursor: pointer;
}
.cancel:hover { color: var(--red); border-color: rgba(255, 95, 107, 0.6); text-shadow: 0 0 6px rgba(255, 95, 107, 0.5); }
.tm { margin-left: auto; font-size: 9px; color: var(--muted); letter-spacing: 0.1em; }
.txt { font-size: 13px; line-height: 1.55; color: var(--ink); }
.txt.pending { color: var(--muted); font-style: italic; }
.txt .caret {
  display: inline-block;
  width: 7px;
  height: 13px;
  background: var(--amber);
  vertical-align: -2px;
  margin-left: 3px;
  box-shadow: 0 0 8px var(--amber);
  animation: blink 1s step-end infinite;
}
.mfoot { display: flex; gap: 14px; margin-top: 6px; font-size: 9px; color: var(--muted); letter-spacing: 0.08em; }
.mfoot .cost { margin-left: auto; color: var(--cyan-dim); }
.livebars { display: inline-flex; align-items: flex-end; gap: 2px; height: 12px; margin-left: 8px; }
.livebars i { width: 3px; background: var(--amber); box-shadow: 0 0 6px var(--amber); animation: eq 0.7s ease-in-out infinite; }
.livebars i:nth-child(1) { height: 40%; animation-delay: 0s; }
.livebars i:nth-child(2) { height: 90%; animation-delay: 0.12s; }
.livebars i:nth-child(3) { height: 60%; animation-delay: 0.24s; }
.livebars i:nth-child(4) { height: 100%; animation-delay: 0.08s; }
.livebars i:nth-child(5) { height: 50%; animation-delay: 0.3s; }
@keyframes eq { 50% { transform: scaleY(0.35); } }
</style>
