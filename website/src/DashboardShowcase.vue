<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
const frame = ref<HTMLElement | null>(null);
const scale = ref(1);
const width = 1440;
const height = 900;
const url = `${import.meta.env.BASE_URL}dashboard-demo.html`;
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (!frame.value) return;
  observer = new ResizeObserver(() => { scale.value = frame.value!.clientWidth / width; });
  observer.observe(frame.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <div ref="frame" class="dashboard-demo" :style="{height: `${height * scale}px`}">
    <iframe :src="url" title="Interactive Noisy Coding dashboard with demonstration data" loading="lazy" :width="width" :height="height" :style="{transform: `scale(${scale})`}" allow="microphone 'none'; camera 'none'" />
  </div>
  <p class="image-caption">The real dashboard, with sample conversations. Try its tabs and character controls. <a :href="url" target="_blank" rel="noopener">Open full size ↗</a></p>
</template>
<style scoped>
.dashboard-demo { width:100%; overflow:hidden; border:1px solid var(--line-strong); border-radius:16px; background:var(--bg0); box-shadow:0 24px 60px #0003; }
iframe { display:block; border:0; transform-origin:top left; max-width:none; }
a { color:var(--amber); text-decoration:underline; text-underline-offset:3px; }
</style>
