<script setup lang="ts">
import type { StatusKind } from "./bubbleStatus";
import VoiceAvatar from "./VoiceAvatar.vue";

const props = withDefaults(
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
    /** Playback is paused mid-utterance (only meaningful while playing). */
    paused?: boolean;
    /** Who is talking, structurally: "agent" is Claude itself, "guest" is
     * any named persona speaking through it (viewers, subagents) - a
     * clearly different surface so guests never read as Claude's words. */
    variant?: "agent" | "guest";
    /** Guest palette: chat platforms carry their brand color. */
    tint?: "green" | "purple" | "red";
    /** Companion mode (#28): text only - no header, no footer, tighter
     * padding. The SAME component everywhere a message renders. */
    compact?: boolean;
    /** Voice identity shared with the voice picker and companion. */
    voice?: string;
  }>(),
  {
    cost: "—",
    detail: "",
    live: false,
    pending: false,
    replayable: false,
    cancelable: false,
    playing: false,
    paused: false,
    variant: "agent",
    tint: "green",
    compact: false,
  },
);

defineEmits<{ replay: []; cancel: []; pause: []; skip: [] }>();

</script>

<template>
  <div class="msg" :class="[`side-${side}`, `accent-${accent}`, `variant-${variant}`, `tint-${tint}`, { withportrait: !!voice, compact }]">
    <VoiceAvatar v-if="voice" class="portrait" :voice="voice" />
    <div class="mbody">
    <div v-if="!compact" class="mhead">
      <span class="who">{{ who }}</span>
      <span class="st" :class="statusKind">{{ statusLabel }}</span>
      <!-- Idle: one replay affordance. Playing: transport controls -
           pause/resume toggles in place, skip is a separate, final action
           (design review: merging them into one button hides "skip" exactly
           when the listener is overwhelmed and needs it most). -->
      <button
        v-if="replayable && !playing"
        class="replay"
        title="Play this message again"
        @click="$emit('replay')"
      >↻ ▶</button>
      <template v-if="playing">
        <button
          class="replay playing"
          :title="paused ? 'Resume playback' : 'Pause playback'"
          @click="$emit('pause')"
        >{{ paused ? "▶" : "⏸" }}</button>
        <button
          class="replay skip"
          title="Skip the rest of this message"
          @click="$emit('skip')"
        >⏭</button>
      </template>
      <button
        v-if="cancelable"
        class="cancel"
        title="Recall this message before the agent reads it"
        @click="$emit('cancel')"
      >✕</button>
      <span v-if="live" class="livebars"><i /><i /><i /><i /><i /></span>
      <span class="tm">{{ time }}</span>
    </div>
    <div v-if="compact" class="compact-label"><span>{{ who || (side === 'left' ? 'You' : 'Agent') }}</span><span v-if="statusLabel && statusKind !== 'done'" class="st" :class="statusKind">{{ statusLabel }}</span></div>
    <div class="txt" :class="{ pending }">{{ text }}<span v-if="live" class="caret" /></div>
    <div v-if="!compact" class="mfoot">
      <span>{{ detail }}</span>
      <span class="cost">{{ cost }}</span>
    </div>
    </div>
  </div>
</template>

<style scoped>

.msg { position:relative; max-width:92%; border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:var(--bg1); --accent:var(--cyan); }
.msg.withportrait { display:flex; align-items:flex-start; gap:12px; }
.mbody { min-width:0; flex:1; }
.portrait { flex:none; }
.accent-amber { --accent:var(--amber); }
.accent-violet { --accent:var(--violet); }
.side-left { align-self:flex-start; background:#292825; border-color:#45413a; border-top-left-radius:4px; }
.side-right { align-self:flex-end; border-top-right-radius:4px; }
.variant-guest { --accent:var(--green); border-left:3px solid var(--accent); background:#232c27; }
.variant-guest.tint-purple { --accent:var(--violet); background:#2a2633; }
.variant-guest.tint-red { --accent:var(--red); background:#302526; }
.mhead { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
.who { font-size:12px; font-weight:600; color:var(--accent); }
.st { font-size:10px; font-weight:500; padding:2px 6px; border-radius:4px; background:var(--surface-hover); color:var(--muted); }
.st.done { color:var(--green); }
.st.work { color:var(--cyan); }
.st.rec { color:var(--amber); }
.st.spoken { color:var(--violet); }
.st.fail { color:var(--red); }
.replay, .cancel { color:var(--muted); background:transparent; border:1px solid var(--line); font-size:12px; padding:3px 7px; min-height:28px; }
.replay:hover, .cancel:hover { color:var(--ink); background:var(--surface-hover); border-color:var(--line-strong); }
.replay.playing { color:var(--amber); }
.replay.skip:hover, .cancel:hover { color:var(--red); }
.tm { margin-left:auto; font-size:10px; color:var(--muted); font-variant-numeric:tabular-nums; }
.txt { font:14px/1.65 var(--sans); color:var(--ink); white-space:pre-wrap; overflow-wrap:anywhere; }
.txt.pending { color:var(--muted); }
.mfoot { display:flex; flex-wrap:wrap; gap:8px; font:10px/1.5 var(--mono); color:var(--muted); margin-top:10px; }
.cost { margin-left:auto; }
.compact { padding:9px 12px; max-width:94%; }
.compact .txt { font-size:13px; line-height:1.55; }
.compact-label { display:flex; align-items:center; gap:8px; margin-bottom:3px; color:var(--accent); font-size:10px; font-weight:600; }
.compact-label .st { font-weight:400; }
.caret { display:inline-block; width:2px; height:14px; background:var(--amber); margin-left:3px; vertical-align:-2px; animation:blink 1s step-end infinite; }
.livebars { display:inline-flex; align-items:center; height:12px; gap:2px; }
.livebars i { width:2px; height:8px; background:var(--amber); animation:eq .7s ease-in-out infinite; }
.livebars i:nth-child(2n) { height:12px; animation-delay:.2s; }
@keyframes blink { 50% { opacity:0; } }
@keyframes eq { 50% { transform:scaleY(.4); } }
@media (max-width:600px) { .msg { max-width:100%; padding:12px; } .mfoot { font-size:10px; } }

</style>
