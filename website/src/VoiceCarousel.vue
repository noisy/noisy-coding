<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import VoiceAvatar from '@dashboard/components/VoiceAvatar.vue';
const voices = [
  { name: 'Lux', role: 'Development' },
  { name: 'Rex', role: 'Pull requests' },
  { name: 'Luna', role: 'Personal' },
  { name: 'Atlas', role: 'Voice portrait' },
  { name: 'Cosmo', role: 'Voice portrait' },
  { name: 'Celeste', role: 'Voice portrait' },
];
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
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <div class="voice-carousel" role="region" aria-label="Explore agent voices">
    <div ref="track" class="voice-track" :class="{ 'more-right': !atEnd }" @scroll="update">
      <article v-for="voice in voices" :key="voice.name" class="voice-card">
        <div class="portrait-only">
          <VoiceAvatar :voice="voice.name.toLowerCase()" set="editorial" :size="88" />
          <strong>{{ voice.name }}</strong><small>{{ voice.role }}</small>
        </div>
      </article>
    </div>
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
</style>
