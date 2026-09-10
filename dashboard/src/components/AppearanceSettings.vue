<script setup lang="ts">
import AccentPalettePicker from './AccentPalettePicker.vue';
import AvatarSetPicker from './AvatarSetPicker.vue';
import Bubble from './Bubble.vue';
</script>
<template>
  <section class="appearance-settings">
    <div class="accent-layout">
    <AccentPalettePicker />
    <aside class="preview" aria-label="Live conversation preview">
      <div class="preview-heading"><span>Conversation preview</span><span>Live preview</span></div>
      <div class="conversation">
        <Bubble side="left" accent="amber" who="You" text="Can you fix the search and run the tests?" status-kind="off" status-label="" time="" compact />
        <Bubble side="right" accent="violet" who="Claude" voice="lux" text="Both tests pass. The fix is ready for review." status-kind="off" status-label="" time="" compact />
        <Bubble side="left" accent="amber" who="You" text="Perfect. Let's ship it." status-kind="off" status-label="" time="" compact />
      </div>
      <p>Your accent and avatar choices appear here immediately.</p>
    </aside>
    </div>
    <AvatarSetPicker />
  </section>
</template>
<style scoped>
.appearance-settings { min-width:0; }
.accent-layout { display:grid; grid-template-columns:minmax(190px,1.2fr) minmax(0,3.8fr); gap:24px; align-items:start; margin-bottom:24px; }
.preview { background:var(--bg1); border:1px solid var(--line); border-radius:16px; padding:20px; min-width:0; }
.preview-heading { display:flex; justify-content:space-between; gap:12px; font-size:12px; margin-bottom:24px; }
.preview-heading span:last-child { color:var(--muted); font-size:11px; }
.conversation { display:flex; flex-direction:column; gap:18px; max-width:600px; margin:auto; }
p { color:var(--muted); margin-top:24px; font-size:11px; }
@media(max-width:760px) { .accent-layout { grid-template-columns:1fr; } }
</style>
