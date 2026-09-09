<script setup lang="ts">
import { ref, computed } from 'vue';
import RecordedCrewScene from './RecordedCrewScene.vue';
import ClaudeCodeMock from './ClaudeCodeMock.vue';
import recording from './recorded-hero/hero-recording.mp4';
import poster from './recorded-hero/hero-recording-poster.jpg';
import take from './recorded-hero/hero-recording.json';
import { recordedHeroConsoleAt } from './recordedHeroConsole';
import { activityAt, presentationTake, type TurnTiming } from './presentationTiming';
const props = withDefaults(defineProps<{ manualPlayback?: boolean; presentationEdits?: TurnTiming[]; cameraZoom?: number; cameraOffsetX?: number; cameraOffsetY?: number }>(), {
  presentationEdits: () => [], cameraZoom: 1.35, cameraOffsetX: 0, cameraOffsetY: 0,
});
const emit = defineEmits<{time: [timeMs: number]}>();
const adjustedTake = computed(() => presentationTake(take, props.presentationEdits));
const activity = (time: number) => activityAt(take, props.presentationEdits, time);
const scene = ref<InstanceType<typeof RecordedCrewScene>>();
defineExpose({ seek: (ms: number) => scene.value?.seek(ms), pause: () => scene.value?.pause(), play: () => scene.value?.play(), restart: () => scene.value?.restart(), toggleSound: () => scene.value?.toggleSound() });
</script>
<template>
  <RecordedCrewScene ref="scene" class="hero-recording" layout="hero"
    :recording-src="recording" :recording-poster="poster" :recording-take="adjustedTake" :manual-playback="manualPlayback" :activity-at-time="activity" @time="emit('time', $event)"
    :camera-zoom="cameraZoom" :camera-offset-x="cameraOffsetX" :camera-offset-y="cameraOffsetY">
    <template #default="{ timeMs }">
      <div class="hero-terminal" :class="{ visible: timeMs >= 1800 }">
        <ClaudeCodeMock full-bleed banner="mascot" title="claude - search-app" project-name="search-app" :transcript="recordedHeroConsoleAt(adjustedTake, timeMs, presentationEdits)" />
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
