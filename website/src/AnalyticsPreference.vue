<script setup lang="ts">
import { ref } from 'vue';
import { websiteAnalytics } from './analytics';
const expanded = ref(false);
const enabled = ref(websiteAnalytics.preference === 'enabled');
const excluded = ref(websiteAnalytics.excluded);
function choose(value: boolean) {
  websiteAnalytics.setEnabled(value);
  enabled.value = value;
  expanded.value = false;
}
function exclude(value: boolean) {
  websiteAnalytics.setExcluded(value);
  excluded.value = value;
  enabled.value = false;
  expanded.value = false;
}
</script>
<template>
  <aside v-if="websiteAnalytics.available" class="analytics-preference" aria-label="Usage analytics">
    <p>We use PostHog for website usage statistics. Analytics starts automatically unless you turn it off or exclude this browser.</p>
    <button v-if="!excluded" type="button" @click="choose(!enabled)">{{ enabled ? 'Turn off analytics' : 'Turn on analytics' }}</button>
    <button type="button" :aria-expanded="expanded" @click="expanded = !expanded">Usage analytics: {{ excluded ? 'browser excluded' : enabled ? 'on' : 'off' }}</button>
    <div v-if="expanded" class="analytics-choice">
      <p>We collect page visits, scroll depth, video-demo controls, and setup or download clicks with PostHog. Analytics uses a random browser ID stored on this device. No voice, conversation content, or session recordings are collected.</p>
      <button type="button" @click="exclude(!excluded)">{{ excluded ? 'Stop excluding this browser' : 'Exclude this browser from analytics' }}</button>
    </div>
  </aside>
</template>
<style scoped>
.analytics-preference { max-width: 720px; margin: 0 auto; padding: 16px 24px 32px; font-size: 13px; }
button { color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 5px; padding: 8px 12px; cursor: pointer; }
.analytics-choice { margin-top: 12px; line-height: 1.6; }
.analytics-choice button { margin: 10px 10px 0 0; }
</style>
