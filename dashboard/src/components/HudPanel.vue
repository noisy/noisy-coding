<script setup lang="ts">
withDefaults(
  defineProps<{
    index?: string;
    title?: string;
  }>(),
  { index: "", title: "" },
);
</script>

<template>
  <section class="panel">
    <div v-if="title" class="ptitle"><span class="idx">{{ index }}</span> {{ title }}</div>
    <slot />
  </section>
</template>

<style scoped>
.panel { position: relative; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; min-width: 0; }
.ptitle { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font: 600 13px/1.4 var(--sans); color: var(--ink); }
.idx { display: none; }
</style>
