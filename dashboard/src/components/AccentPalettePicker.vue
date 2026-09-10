<script setup lang="ts">
import { accentPalettes } from '../styles/accentPalettes';
import { useAccentPalette } from '../composables/useAccentPalette';
const { accent, selectAccent } = useAccentPalette();
</script>
<template>
  <fieldset class="accent-picker">
    <legend>Accent color</legend>
    <p>Choose the highlight color for your messages and interface. Saved on this device.</p>
    <div class="options">
      <label v-for="palette in accentPalettes" :key="palette.value" :data-accent="palette.value" :class="{selected: accent === palette.value}">
        <input type="radio" name="accent-color" :value="palette.value" :checked="accent === palette.value" @change="selectAccent(palette.value)">
        <span class="swatch" />{{ palette.title }}
      </label>
    </div>
  </fieldset>
</template>
<style scoped>
.accent-picker { border:0; padding:0 0 24px; min-width:0; }
legend { font-size:16px; font-weight:600; }
p { color:var(--muted); font-size:12px; margin:8px 0 14px; }
.options { display:flex; flex-wrap:wrap; gap:10px; }
label { display:flex; align-items:center; gap:8px; border:1px solid var(--line); background:var(--bg1); border-radius:9px; padding:10px 14px; cursor:pointer; }
label.selected { border-color:var(--amber); background:var(--accent-surface); }
.swatch { width:16px; height:16px; border-radius:50%; background:var(--amber); }
input { accent-color:var(--amber); }
</style>
