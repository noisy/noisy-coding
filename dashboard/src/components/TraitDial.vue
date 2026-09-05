<script setup lang="ts">
/** Native range input keeps character editing usable with mouse and keyboard. */
defineProps<{ value: number; label: string; word: string; color: string }>();
const emit = defineEmits<{ input: [value: number]; commit: [value: number] }>();
const valueOf = (event: Event) => Number((event.target as HTMLInputElement).value);
</script>

<template>
  <label class="gauge">
    <span class="trait-heading"><span class="gl">{{ label }}</span><span class="gv">{{ value }}</span></span>
    <input type="range" min="0" max="100" step="20" :value="value" :aria-label="label"
      :aria-valuetext="`${value} · ${word}`" :style="{ accentColor: color }"
      @input="emit('input', valueOf($event))" @change="emit('commit', valueOf($event))" />
    <span class="gw">{{ word }}</span>
  </label>
</template>

<style scoped>
.gauge { display:flex; flex-direction:column; gap:5px; min-width:0; }
.trait-heading { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.gl { font-size:12px; color:var(--ink); }
.gv { font:11px var(--mono); color:var(--muted); }
input { width:100%; height:22px; margin:0; cursor:pointer; }
.gw { color:var(--muted); font-size:11px; }
</style>
