<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import VoiceAvatar from '@dashboard/components/VoiceAvatar.vue';
import voices from './assets/voice-intros/scripts.json';
const samples = import.meta.glob('./assets/voice-intros/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const playing = ref('');
const error = ref('');
let audio: HTMLAudioElement | undefined;
let playRequest = 0;
function stopSample() {
  ++playRequest;
  audio?.pause();
  audio = undefined;
  playing.value = '';
}
async function toggleSample(name: string) {
  const wasPlaying = playing.value === name;
  stopSample();
  error.value = '';
  if (wasPlaying) return;
  const src = samples[`./assets/voice-intros/${name.toLowerCase()}.mp3`];
  if (!src) return;
  const request = playRequest;
  audio = new Audio(src);
  audio.onended = () => { if (request === playRequest) stopSample(); };
  playing.value = name;
  try { await audio.play(); }
  catch { if (request === playRequest) { stopSample(); error.value = 'Could not play the sample. Please try again.'; } }
}
const track = ref<HTMLElement | null>(null);
const atStart = ref(true);
const atEnd = ref(false);
let observer: ResizeObserver | undefined;
function update() {
  const el = track.value;
  if (!el) return;
  atStart.value = el.scrollLeft < 2;
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
}
function move(direction: number) {
  const el = track.value;
  if (!el) return;
  const card = el.firstElementChild as HTMLElement;
  el.scrollBy({ left: direction * (card.offsetWidth + 12), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
onMounted(() => {
  observer = new ResizeObserver(update);
  if (track.value) observer.observe(track.value);
  update();
});
onBeforeUnmount(() => { observer?.disconnect(); stopSample(); });
</script>
<template>
  <div class="voice-carousel" role="region" aria-label="Explore agent voices">
    <div ref="track" class="voice-track" :class="{ 'more-right': !atEnd }" @scroll="update">
      <article v-for="voice in voices" :key="voice.name" class="voice-card">
        <div class="portrait-only">
          <VoiceAvatar :voice="voice.name.toLowerCase()" set="editorial" :size="88" />
          <strong>{{ voice.name }}</strong><small>{{ voice.role }}</small>
          <button v-if="samples[`./assets/voice-intros/${voice.name.toLowerCase()}.mp3`]" class="listen" type="button" :aria-label="`${playing === voice.name ? 'Stop' : 'Listen to'} ${voice.name}`" :aria-pressed="playing === voice.name" @click="toggleSample(voice.name)">{{ playing === voice.name ? '■ Stop' : '▶ Listen' }}</button>
        </div>
      </article>
    </div>
    <p v-if="error" role="status">{{ error }}</p>
    <div class="carousel-controls">
      <span>Find a familiar voice</span>
      <button type="button" aria-label="Previous voices" :disabled="atStart" @click="move(-1)">←</button>
      <button type="button" aria-label="Next voices" :disabled="atEnd" @click="move(1)">→</button>
    </div>
  </div>
</template>
<style scoped>
.voice-carousel { margin:28px 0; min-width:0; }
.voice-track { display:flex; gap:12px; overflow-x:auto; overscroll-behavior-x:contain; scroll-snap-type:x mandatory; scrollbar-width:none; padding:6px 0; }
.voice-track::-webkit-scrollbar { display:none; }
.voice-track.more-right { mask-image:linear-gradient(to right,#000 0%,#000 86%,rgba(0,0,0,.2) 100%); }
.voice-card { flex:0 0 calc((100% - 36px) / 3.35); min-width:0; scroll-snap-align:start; background:#282a30; border:1px solid var(--line-strong); border-radius:14px; overflow:hidden; }
.portrait-only { display:flex; flex-direction:column; align-items:center; width:100%; padding:12px 6px; color:var(--ink); background:none; border:0; text-align:center; font:inherit; }
.voice-card :deep(.voice-avatar) { width:100% !important; height:auto !important; aspect-ratio:1; max-width:88px; margin-bottom:10px; }
strong { font-size:13px; font-weight:550; }
small { font-size:10px; color:var(--muted); white-space:nowrap; }
.carousel-controls { display:flex; align-items:center; gap:6px; margin-top:10px; }
.carousel-controls span { margin-right:auto; font-size:11px; color:var(--muted); }
.carousel-controls button { border:1px solid var(--line-strong); border-radius:7px; background:var(--bg0); color:var(--ink); width:32px; height:30px; cursor:pointer; }
.carousel-controls button:disabled { opacity:.3; cursor:default; }
.listen { margin-top:10px; border:1px solid var(--accent-border); background:var(--accent-surface); color:var(--amber); padding:6px 10px; font-size:11px; }
</style>
