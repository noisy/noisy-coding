<script setup lang="ts">
import { accentPalettes } from '../styles/accentPalettes';
import { useAccentPalette } from '../composables/useAccentPalette';
const { accent, selectAccent, agentAccent, selectAgentAccent } = useAccentPalette();
</script>
<template>
  <section class="accent-picker">
    <h2>Accent colors</h2>
    <p>Your accent also colors interface highlights.</p>
    <fieldset v-for="role in ['user', 'agent']" :key="role">
      <legend>{{ role === 'user' ? 'Your messages' : 'Agent messages' }}</legend>
      <div class="options">
        <label v-for="palette in accentPalettes" :key="palette.value" :data-accent="palette.value" :title="palette.title" :class="{selected: (role === 'user' ? accent : agentAccent) === palette.value}">
          <input type="radio" :name="`${role}-accent-color`" :aria-label="palette.title" :value="palette.value" :checked="(role === 'user' ? accent : agentAccent) === palette.value" @change="role === 'user' ? selectAccent(palette.value) : selectAgentAccent(palette.value)">
          <span class="swatch" aria-hidden="true" />
        </label>
      </div>
    </fieldset>
  </section>
</template>
<style scoped>
.accent-picker { padding:0 0 24px; min-width:0; }
h2 { font-size:16px; font-weight:600; }
p { color:var(--muted); font-size:12px; margin:8px 0 18px; }
fieldset { border:0; padding:0; margin:0 0 16px; min-width:0; }
legend { font-size:12px; margin-bottom:8px; }
.options { display:grid; grid-template-columns:repeat(10,minmax(0,1fr)); gap:2px; max-width:320px; }
label { position:relative; display:grid; place-items:center; width:100%; height:26px; border:2px solid transparent; border-radius:6px; cursor:pointer; }
label.selected { border-color:var(--amber); }
label:focus-within { outline:2px solid var(--ink); outline-offset:2px; }
.swatch { width:calc(100% - 4px); height:18px; border-radius:3px; background:var(--amber); }
input { position:absolute; width:1px; height:1px; clip-path:inset(50%); overflow:hidden; }
</style>
