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
      <label v-for="palette in accentPalettes" :key="palette.value" :data-accent="palette.value" :title="palette.title" :class="{selected: accent === palette.value}">
        <input type="radio" name="accent-color" :aria-label="palette.title" :value="palette.value" :checked="accent === palette.value" @change="selectAccent(palette.value)">
        <span class="swatch" aria-hidden="true" />
      </label>
    </div>
  </fieldset>
</template>
<style scoped>
.accent-picker { border:0; padding:0 0 24px; min-width:0; }
legend { font-size:16px; font-weight:600; }
p { color:var(--muted); font-size:12px; margin:8px 0 14px; }
.options { display:flex; flex-wrap:wrap; gap:10px; }
label { position:relative; display:grid; place-items:center; width:44px; height:44px; border:2px solid transparent; border-radius:12px; cursor:pointer; }
label.selected { border-color:var(--amber); }
label:focus-within { outline:2px solid var(--ink); outline-offset:3px; }
.swatch { width:30px; height:30px; border-radius:8px; background:var(--amber); }
input { position:absolute; width:1px; height:1px; clip-path:inset(50%); overflow:hidden; }
</style>
