<script setup lang="ts">
// Set the release asset URL here once the binary is ready.
const downloadUrl: string | undefined = undefined;
</script>
<template>
  <component :is="downloadUrl ? 'a' : 'button'" class="button primary download-button" :href="downloadUrl" :disabled="!downloadUrl" :title="downloadUrl ? undefined : 'Download unavailable'">
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>
    <span>Download Noisy Studio</span>
  </component>
</template>
<style scoped>
.download-button { min-height: 60px; padding: 17px 25px; gap: 13px; font-size: 16px; font-weight: 650; box-shadow: 0 4px 22px #80d1cb16; }
.download-button:disabled { opacity: 1; cursor: default; }
.download-button:disabled:hover { transform: none; background: var(--brand-accent); }
.download-button svg { flex-shrink: 0; }
</style>
