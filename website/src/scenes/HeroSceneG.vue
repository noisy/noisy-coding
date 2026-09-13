<script setup lang="ts">
import { websiteAnalytics } from '../analytics';
import RecordedHeroScene from '@dashboard/components/marketing/RecordedHeroScene.vue';
import { useStage } from './shared';
const { frame, scale } = useStage();
</script>
<template>
  <div ref="frame" class="hero-demo" :style="{ height: `${760 * scale}px` }">
    <RecordedHeroScene @interaction="websiteAnalytics.trackDemo('hero', $event)" :style="{ transform: `scale(${scale})` }" />
  </div>
</template>
<style scoped>
.hero-demo { min-width: 0; position: relative; overflow: hidden; border-radius: 10px; }
.hero-demo > * { transform-origin: top left; }
</style>
