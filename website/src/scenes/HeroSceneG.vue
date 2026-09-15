<script setup lang="ts">
import { websiteAnalytics } from '../analytics';
import RecordedHeroScene from '@dashboard/components/marketing/RecordedHeroScene.vue';
// Keep this a lightweight website copy when replacing it with actor footage.
// Preserve the original/master; regenerate with tools/website-media/generate.py
// following tools/website-media/README.md instead of embedding the full-size recording.
import recording from '../assets/optimized/hero-recording.mp4';
import { useStage } from './shared';
const { frame, scale } = useStage();
</script>
<template>
  <div ref="frame" class="hero-demo" :style="{ height: `${760 * scale}px` }">
    <RecordedHeroScene :recording-src="recording" @interaction="websiteAnalytics.trackDemo('hero', $event)" :style="{ transform: `scale(${scale})` }" />
  </div>
</template>
<style scoped>
.hero-demo { min-width: 0; position: relative; overflow: hidden; border-radius: 10px; }
.hero-demo > * { transform-origin: top left; }
</style>
