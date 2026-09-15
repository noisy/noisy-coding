<script setup lang="ts">
import KeyboardHotkeyDemo from './KeyboardHotkeyDemo.vue';
defineProps<{ staticPreview?: boolean }>();
</script>
<template>
  <section class="hotkey-section">
    <div class="hotkey-layout">
      <div class="hotkey-copy">
        <p class="hotkey-eyebrow">PICK UP THE RIGHT CONVERSATION</p>
        <h2>Your agents.<br><em>One key away.</em></h2>
        <p class="hotkey-intro">Give each conversation its own shortcut. Jump to work, a side project, or something personal—with a single key press.</p>
        <div class="hotkey-detail"><span>01 — Assign</span><p>Your keys. Your conversations.</p></div>
        <div class="hotkey-detail"><span>02 — Switch</span><p>Press a key. Pick up where you left off.</p></div>
        <p class="hotkey-note">F16–F19 shown as an example.<br>Choose the shortcuts that work for you.</p>
      </div>
      <KeyboardHotkeyDemo :static-preview="staticPreview" />
    </div>
  </section>
</template>
<style scoped>
.hotkey-section { background:#16191d; padding:90px 36px; color:#e8edef; font-family:Inter,ui-sans-serif,system-ui,sans-serif; border-bottom:1px solid #32383e; }.hotkey-layout { max-width:1280px; margin:auto; display:grid; grid-template-columns:minmax(250px,.68fr) minmax(0,1.32fr); gap:64px; align-items:center; }.hotkey-eyebrow { font-size:10px; letter-spacing:.15em; color:#8bcebf; margin:0 0 20px; }.hotkey-copy h2 { font-size:clamp(38px,4.1vw,60px); line-height:1.05; font-weight:550; letter-spacing:-.055em; margin:0 0 24px; }.hotkey-copy em { color:#8ed1c1; font-style:normal; }.hotkey-intro { color:#aeb7c0; font-size:16px; line-height:1.65; margin:0 0 32px; max-width:350px; }.hotkey-detail { border-top:1px solid #333a40; padding:15px 0; }.hotkey-detail span { color:#b4b7ed; font-size:11px; }.hotkey-detail p { margin:6px 0 0; font-size:13px; color:#c7ced3; }.hotkey-note { font-size:11px; line-height:1.6; color:#798791; margin:20px 0 0; }
@media(max-width:1000px) { .hotkey-layout { gap:32px; grid-template-columns: minmax(220px,.6fr) minmax(0,1.4fr); }.hotkey-section { padding:60px 24px; } }
@media(max-width:760px) { .hotkey-layout { grid-template-columns:1fr; }.hotkey-section { padding:48px 18px; }.hotkey-copy h2 { font-size:44px; }.hotkey-intro { max-width:500px; }.hotkey-detail,.hotkey-note { display:none; } }
</style>
