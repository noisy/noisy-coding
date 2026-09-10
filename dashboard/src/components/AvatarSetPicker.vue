<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { AVATAR_SETS, AVATAR_VOICES } from '../avatars/catalog';
import { useAvatarSet } from '../composables/useAvatarSet';
import VoiceAvatar from './VoiceAvatar.vue';
const { avatarSet, selectAvatarSet } = useAvatarSet();
const SAMPLE_SIZE = 36;
const SAMPLE_GAP = 4;
const sampleCount = ref(4);
const sampleVoices = computed(() => AVATAR_VOICES.slice(0, sampleCount.value));
const options = ref<HTMLElement>();
let optionsObserver: ResizeObserver | undefined;
const gallery = ref<HTMLElement>();
const portraitSize = ref(96);
const columns = ref(6);
let observer: ResizeObserver | undefined;
onMounted(() => {
  const row = options.value?.querySelector('.sample-avatars');
  if (row) {
    optionsObserver = new ResizeObserver(([entry]) => {
      if (entry) sampleCount.value = Math.max(1, Math.floor((entry.contentRect.width + SAMPLE_GAP) / (SAMPLE_SIZE + SAMPLE_GAP)));
    });
    optionsObserver.observe(row);
  }
  if (!gallery.value) return;
  observer = new ResizeObserver(([entry]) => {
    if (!entry || entry.contentRect.width <= 0) return;
    const { width, height } = entry.contentRect;
    columns.value = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(AVATAR_VOICES.length * width / Math.max(height, 400)))));
    const rows = Math.ceil(AVATAR_VOICES.length / columns.value);
    const cellWidth = (width - (columns.value - 1) * 12) / columns.value;
    const cellHeight = (height - (rows - 1) * 12) / rows - 24;
    portraitSize.value = Math.floor(Math.min(cellWidth, Math.max(80, cellHeight)));
  });
  observer.observe(gallery.value);
});
onBeforeUnmount(() => { observer?.disconnect(); optionsObserver?.disconnect(); });
</script>

<template>
  <fieldset class="avatar-picker">
    <legend>Voice avatars</legend>
    <p>Choose how voices look in the dashboard and companion. Your choice is saved on this device.</p>
    <div class="avatar-browser">
    <div ref="options" class="avatar-options">
      <label v-for="set in AVATAR_SETS" :key="set.id" class="avatar-option" :class="{ selected: avatarSet === set.id }">
        <span class="option-heading"><input type="radio" name="avatar-set" :value="set.id" :checked="avatarSet === set.id" @change="selectAvatarSet(set.id)"><strong>{{ set.name }}</strong></span>
        <span class="sample-avatars"><VoiceAvatar v-for="voice in sampleVoices" :key="voice" :voice="voice" :set="set.id" :size="SAMPLE_SIZE" /></span>
      </label>
    </div>
    <div ref="gallery" class="all-avatars" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }" aria-label="All voices in the selected avatar family">
      <div v-for="voice in AVATAR_VOICES" :key="voice" class="voice-preview">
        <VoiceAvatar :voice="voice" :size="portraitSize" />
        <span>{{ voice }}</span>
      </div>
    </div>
    </div>
  </fieldset>
</template>

<style scoped>
.avatar-picker { border:0; padding:0; min-width:0; color:var(--ink); }
legend { font-size:16px; font-weight:600; }
p { color:var(--muted); font-size:12px; margin:8px 0 16px; }
.avatar-browser { display:grid; grid-template-columns:minmax(190px,1.2fr) minmax(0,3.8fr); gap:24px; height:552px; }
.avatar-options { display:flex; flex-direction:column; gap:12px; overflow-y:scroll; scrollbar-gutter:stable; min-height:0; padding:2px 8px 2px 2px; }
.avatar-option { flex:0 0 100px; display:grid; gap:4px; padding:10px; background:var(--bg1); border:1px solid var(--line); border-radius:10px; cursor:pointer; }
.avatar-option.selected { border-color:var(--amber); }
.option-heading { display:flex; align-items:center; gap:8px; font-size:13px; }
.sample-avatars { display:flex; flex-wrap:nowrap; gap:4px; min-width:0; width:100%; align-items:center; }
.option-heading input { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
.avatar-option:focus-within { outline:2px solid var(--cyan); outline-offset:2px; }
.all-avatars { display:grid; gap:12px; align-content:space-between; overflow-y:auto; min-height:0; padding:2px 8px; }
.voice-preview { display:grid; justify-items:center; gap:4px; font-size:12px; color:var(--muted); }
@media (max-width:760px) { .avatar-browser { grid-template-columns:1fr; height:auto; } .avatar-options { height:552px; } .all-avatars { overflow:visible; } }
</style>
