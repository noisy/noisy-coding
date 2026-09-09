<script setup lang="ts">
import { ref } from 'vue';
import RecordedCrewScene from './RecordedCrewScene.vue';
import ClaudeCodeMock from './ClaudeCodeMock.vue';
import recording from './recorded-hero/hero-recording.mp4';
import poster from './recorded-hero/hero-recording-poster.jpg';
import take from './recorded-hero/hero-recording.json';
import { recordedHeroConsoleAt } from './recordedHeroConsole';
withDefaults(defineProps<{ cameraZoom?: number; cameraOffsetX?: number; cameraOffsetY?: number }>(), {
  cameraZoom: 1.35, cameraOffsetX: 0, cameraOffsetY: 0,
});
const scene = ref<InstanceType<typeof RecordedCrewScene>>();
defineExpose({ restart: () => scene.value?.restart(), toggleSound: () => scene.value?.toggleSound() });
</script>
<template>
  <RecordedCrewScene ref="scene" class="hero-recording" layout="hero"
    :recording-src="recording" :recording-poster="poster" :recording-take="take"
    :camera-zoom="cameraZoom" :camera-offset-x="cameraOffsetX" :camera-offset-y="cameraOffsetY">
    <template #default="{ timeMs }">
      <div class="hero-terminal" :class="{ visible: timeMs >= 1800 }">
        <ClaudeCodeMock full-bleed banner="mascot" title="claude - search-app" project-name="search-app" :transcript="recordedHeroConsoleAt(take, timeMs)" />
      </div>
    </template>
  </RecordedCrewScene>
</template>
<style scoped>
.hero-recording.hero { background: url('./recorded-hero/mac-desktop.png') center / cover no-repeat; }
.hero-terminal { position: absolute; inset: 73px 87px 89px; opacity: 0; transform: translateX(-1260px); filter: saturate(.4) brightness(.75); transition: opacity .5s ease, transform 1s cubic-bezier(.22,.8,.3,1); }
.hero-terminal.visible { opacity: 1; transform: translateX(0); }
@media(prefers-reduced-motion: reduce) { .hero-terminal { opacity: 1; transform: none; transition: none; } }
</style>
