<script setup lang="ts">
import { computed } from "vue";
import type { StatusKind } from "./bubbleStatus";
import { voiceSpriteStyle } from "./voiceSprites";

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
    /** Voice name — when it maps to a portrait in the avatars sprite, the
     * bubble grows a portrait column (same artwork as the voice picker). */
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

// Voice portrait (the same artwork as the voice picker) rendered INSIDE
// the bubble as a left column. No portrait, no column - a monogram tile
// was tried and rejected in design review.
const portrait = computed(() => (props.voice ? voiceSpriteStyle(props.voice) : null));
</script>

<template>
  <div class="msg" :class="[`side-${side}`, `accent-${accent}`, `variant-${variant}`, `tint-${tint}`, { withportrait: !!portrait }]">
    <span v-if="portrait" class="portrait" :style="portrait" aria-hidden="true" />
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
        title="Recall this message before Claude reads it"
        @click="$emit('cancel')"
      >✕</button>
      <span v-if="live" class="livebars"><i /><i /><i /><i /><i /></span>
      <span class="tm">{{ time }}</span>
    </div>
    <div class="txt" :class="{ pending }">{{ text }}<span v-if="live" class="caret" /></div>
    <div v-if="!compact" class="mfoot">
      <span>{{ detail }}</span>
      <span class="cost">{{ cost }}</span>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Voice portrait as a left column inside the bubble - as tall as the
   content allows, small margins, same artwork as the voice picker. */
.msg.withportrait { display: flex; gap: 12px; align-items: stretch; }
.msg.withportrait .mbody { min-width: 0; flex: 1; }
.portrait {
  flex: none;
  align-self: flex-start; /* long messages: pin to the top, don't float mid-text */
  width: 64px;
  height: 64px;
  border: 1px solid var(--accent);
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
}

.msg {
  position: relative;
  border: 1px solid var(--line);
  background: rgba(5, 14, 24, 0.85);
  padding: 10px 14px 9px;
  max-width: 88%;
}
/* Guests (viewers, subagent personas) get a SOLID, unmistakably different
   surface - deep tinted fill, matching accents, no violet anywhere.
   Picked live on stream 2026-08-22 (variant C). The TINT carries the
   platform: guest green by default, Twitch purple, YouTube red - all
   through three custom properties so the rules below stay single-sourced. */
.msg.variant-guest {
  /* guest green - the default tint */
  --guest: #4dffb4;
  --guest-glow: 77, 255, 180;
  --guest-fill: #0a1f18;
}
.msg.variant-guest.tint-purple {
  /* Twitch brand violet, lightened for legibility on the dark fill */
  --guest: #a970ff;
  --guest-glow: 169, 112, 255;
  --guest-fill: #170f26;
}
.msg.variant-guest.tint-red {
  /* YouTube red, warmed so white text beside it still breathes */
  --guest: #ff5a52;
  --guest-glow: 255, 90, 82;
  --guest-fill: #24100e;
}
.msg.variant-guest {
  --accent: var(--guest);
  background: var(--guest-fill);
  border-color: rgba(var(--guest-glow), 0.35);
}
.msg.variant-guest.side-right {
  background: linear-gradient(270deg, rgba(var(--guest-glow), 0.10), var(--guest-fill) 45%);
  border-right-color: var(--guest);
}
.msg.variant-guest .who { color: var(--guest); text-shadow: 0 0 8px rgba(var(--guest-glow), 0.5); }
.msg.variant-guest .portrait { border-color: rgba(var(--guest-glow), 0.6); }
.msg.variant-guest .txt { color: #e6ecea; }

.msg.accent-amber { --accent: var(--amber); --accent-tint: rgba(255, 180, 84, 0.07); }
.msg.accent-violet { --accent: var(--violet); --accent-tint: color-mix(in srgb, var(--violet) 7%, transparent); }
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
.msg.compact { padding: 7px 11px; max-width: 100%; }
.msg.compact .txt { font-size: 12px; }
.mhead { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.who { font-size: 10px; letter-spacing: 0.26em; font-weight: 700; }
.accent-amber .who { color: var(--amber); text-shadow: var(--glow-amber); }
.accent-violet .who { color: var(--violet); text-shadow: 0 0 8px color-mix(in srgb, var(--violet) 50%, transparent); }
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
.st.spoken { color: var(--violet); border-color: color-mix(in srgb, var(--violet) 45%, transparent); }
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
.replay.skip { color: var(--cyan-dim); }
.replay.skip:hover { color: var(--red); border-color: rgba(255, 95, 107, 0.6); text-shadow: 0 0 6px rgba(255, 95, 107, 0.5); }
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
