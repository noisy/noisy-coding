<script setup lang="ts">
import { ref } from 'vue';
import { websiteAnalytics } from './analytics';
const expanded = ref(websiteAnalytics.preference === null);
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
    <button type="button" :aria-expanded="expanded" @click="expanded = !expanded">Usage analytics: {{ excluded ? 'browser excluded' : enabled ? 'on' : 'off' }}</button>
    <div v-if="expanded" class="analytics-choice">
      <p>Help improve Noisy Studio by sharing page visits, scroll depth, video-demo controls, and setup or download clicks with PostHog. Optional analytics uses a random browser ID stored on this device. No voice, conversation content, or session recordings are collected.</p>
      <button type="button" :disabled="excluded" @click="choose(true)">Allow analytics</button>
      <button type="button" @click="choose(false)">No thanks</button>
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
