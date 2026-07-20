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
.panel {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 14px 16px 16px;
  backdrop-filter: blur(3px);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  margin-bottom: 18px;
}
.panel::before,
.panel::after {
  content: "";
  position: absolute;
  width: 22px;
  height: 22px;
  pointer-events: none;
}
.panel::before { top: 0; right: 0; border-top: 2px solid var(--line-strong); border-right: 2px solid var(--line-strong); }
.panel::after { bottom: 0; left: 0; border-bottom: 2px solid var(--line-strong); border-left: 2px solid var(--line-strong); }
.ptitle {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 10px;
  letter-spacing: 0.3em;
  color: var(--cyan);
  text-transform: uppercase;
}
.ptitle::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, var(--line-strong), transparent); }
.ptitle .idx { color: var(--muted); letter-spacing: 0.1em; }
</style>
