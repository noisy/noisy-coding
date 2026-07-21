<script setup lang="ts">
import { computed } from "vue";
import VoiceSelector from "./VoiceSelector.vue";
import { voiceSpriteStyle } from "./voiceSprites";

// The conversation's voice identity: portrait on top (ON AIR rides OVER
// the image), the voice picker directly beneath. Grew out of the plain
// Avatar once the selector moved in from the Character Matrix.
const props = defineProps<{
  voice: string;
  speaking?: boolean;
  muted?: boolean;
}>();

defineEmits<{ change: [voice: string]; "toggle-mute": [] }>();

const spriteStyle = computed(() => voiceSpriteStyle(props.voice));

// Fallback identity for voices without a portrait: deterministic
// per-voice color + monogram.
const hue = computed(() => {
  let h = 0;
  for (const ch of props.voice) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
});
const color = computed(() => `hsl(${hue.value}, 85%, 62%)`);
const dim = computed(() => `hsla(${hue.value}, 85%, 62%, 0.12)`);
const monogram = computed(() => (props.voice ? props.voice[0].toUpperCase() : "?"));
</script>

<template>
  <div class="persona" :class="{ speaking, muted }">
    <div class="frame">
      <div v-if="spriteStyle" class="portrait" :style="spriteStyle" />
      <svg v-else viewBox="0 0 92 92" aria-hidden="true" class="fallback">
        <polygon
          points="46,4 82,25 82,67 46,88 10,67 10,25"
          :fill="dim" :stroke="color" stroke-width="2"
        />
        <text x="46" y="56" text-anchor="middle" :fill="color" class="mono">{{ monogram }}</text>
      </svg>
      <span v-if="speaking && !muted" class="onair">◉ ON AIR</span>
      <!-- Per-conversation mute lives ON the portrait (bottom-left); its
           red pressed state doubles as the muted indicator, so no extra
           MUTED tag is needed. -->
      <button
        class="mutebtn"
        :class="{ on: muted }"
        :title="muted ? 'Unmute this conversation' : 'Mute this conversation'"
        @click="$emit('toggle-mute')"
      >{{ muted ? "MUTED" : "MUTE" }}</button>
    </div>
    <VoiceSelector :voice="voice" @change="(v) => $emit('change', v)" />
  </div>
</template>

<style scoped>
.persona { display: flex; flex-direction: column; gap: 10px; }
.frame { position: relative; }
.portrait {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--line-strong);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  filter: saturate(1.05);
  box-shadow: 0 0 14px rgba(63, 216, 255, 0.12);
}
.persona.speaking .portrait { box-shadow: 0 0 22px rgba(63, 216, 255, 0.4); }
/* Muted conversation: red — the same alarm language as the MUTE MIC
   button on the left. The portrait dims under a red-tinted frame. */
.persona.muted .portrait,
.persona.muted .fallback {
  /* Red, not reddish-grey: desaturate, then rotate what's left toward
     red and let a strong red wash flood the frame. */
  filter: grayscale(0.85) brightness(0.7) sepia(0.6) hue-rotate(-45deg) saturate(2.2);
}
.persona.muted .portrait {
  border-color: rgba(255, 95, 107, 0.85);
  box-shadow: 0 0 22px rgba(255, 95, 107, 0.45), inset 0 0 70px rgba(255, 95, 107, 0.3);
}
.mutebtn {
  position: absolute;
  /* Flush with the portrait's bottom-left corner — no floating offset. */
  bottom: 0;
  left: 0;
  padding: 13px 22px;
  font-family: var(--mono);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--muted);
  background: rgba(4, 12, 20, 0.72);
  border: 1px solid rgba(93, 127, 150, 0.35);
  cursor: pointer;
  clip-path: polygon(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px);
}
.mutebtn:hover { color: var(--cyan); border-color: var(--cyan-dim); }
.mutebtn.on {
  color: var(--red, #ff5f6b);
  border-color: rgba(255, 95, 107, 0.65);
  background: rgba(255, 95, 107, 0.1);
}
.fallback { width: 60%; display: block; margin: 0 auto; }
.mono { font-family: var(--mono); font-size: 34px; font-weight: 700; letter-spacing: 0.05em; }
/* ON AIR rides OVER the portrait, pinned to its top-right corner. */
.onair {
  position: absolute;
  top: 8px;
  right: 12px;
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.24em;
  color: var(--green, #6dff9e);
  background: rgba(4, 12, 20, 0.72);
  border: 1px solid rgba(109, 255, 158, 0.18);
  text-shadow: 0 0 6px var(--green, #6dff9e);
  animation: onair-pulse 1.2s ease-in-out infinite;
}
@keyframes onair-pulse { 50% { opacity: 0.45; } }
</style>
