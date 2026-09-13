<script setup>
import { onBeforeUnmount, ref } from 'vue';
const props = defineProps({ recording: String, agents: String, camera: Boolean, durationMs: Number });
const emit = defineEmits(['time']);
const media = ref(null), voices = ref(null), playbackError = ref('');
const position = ref(0);
let frame, request = 0;
function sample() {
  if (!media.value) return;
  position.value = media.value.currentTime * 1000;
  emit('time', position.value);
  if (voices.value && !voices.value.paused && Math.abs(voices.value.currentTime - media.value.currentTime) > .1) voices.value.currentTime = media.value.currentTime;
  frame = requestAnimationFrame(sample);
}
async function playing() {
  cancelAnimationFrame(frame); sample();
  if (!voices.value) return;
  const current = ++request;
  voices.value.currentTime = media.value.currentTime;
  voices.value.playbackRate = media.value.playbackRate;
  try { await voices.value.play(); if (current !== request && media.value?.paused) voices.value?.pause(); }
  catch { playbackError.value = 'Agent audio could not play. Pause and try Play again.'; media.value?.pause(); }
}
function pause() { ++request; cancelAnimationFrame(frame); voices.value?.pause(); }
function update() { position.value = media.value.currentTime * 1000; emit('time', position.value); }
function seek(event) { media.value.currentTime = Number(event.target.value) / 1000; update(); }
function seeked() { update(); if (!media.value.paused) void playing(); }
function rate() { if (voices.value) voices.value.playbackRate = media.value.playbackRate; }
function volume() { if (voices.value) { voices.value.muted = media.value.muted; voices.value.volume = media.value.volume; } }
onBeforeUnmount(() => { pause(); media.value?.pause(); });
</script>
<template>
  <div class="take-player">
    <p class="field-label">Review the full conversation · video, widget & voices</p>
    <component :is="camera ? 'video' : 'audio'" ref="media" :src="recording" class="take-review" controls playsinline preload="metadata" aria-label="Review synchronized take" @playing="playing" @pause="pause" @waiting="pause" @seeking="pause" @seeked="seeked" @ended="pause" @timeupdate="update" @ratechange="rate" @volumechange="volume" />
    <audio ref="voices" :src="agents" preload="auto" aria-hidden="true"></audio>
    <label class="field-label">Seek through the take <input aria-label="Take position" type="range" min="0" :max="durationMs" step="10" :value="position" @input="seek"></label>
    <p v-if="playbackError" role="alert">{{ playbackError }}</p>
  </div>
</template>
