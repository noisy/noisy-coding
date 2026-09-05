<script setup lang="ts">
import { onUnmounted } from 'vue';
import CompanionView from '../components/CompanionView.vue';

withDefaults(defineProps<{
  backdrop?: 'light' | 'dark' | 'colorful';
  width?: number;
  height?: number;
}>(), { backdrop: 'light', width: 420, height: 280 });

document.body.classList.add('companion-transparent');
onUnmounted(() => document.body.classList.remove('companion-transparent'));
</script>

<template>
  <div class="preview" :class="backdrop">
    <header class="preview-heading">
      <div><strong>Companion over {{ backdrop === 'colorful' ? 'a colorful' : 'a ' + backdrop }} workspace</strong>
        <p>Transparent gaps, readable messages. Scroll inside the conversation to revisit earlier turns.</p>
      </div>
      <span>{{ width }} × {{ height }} px</span>
    </header>
    <div class="workspace">
      <div class="document" aria-hidden="true">
        <span class="eyebrow">Workspace / Notes</span>
        <h2>A little room to think.</h2>
        <p>Keep the conversation close while your work stays in view.</p>
        <div v-for="row in 8" :key="row" class="document-row">
          <span>{{ String(row).padStart(2, '0') }}</span><i /><i />
        </div>
      </div>
      <div class="window-preview" :style="{ width: width + 'px', height: height + 'px' }">
        <CompanionView />
      </div>
    </div>
    <p class="preview-note">The labeled bar moves the desktop window; its edges resize it. This browser preview demonstrates the same window contents and transparency.</p>
  </div>
</template>

<style scoped>
.preview { --paper:#fff; --paper-ink:#24272d; --paper-muted:#5f6672; --paper-line:#e1e4e9; padding:32px; min-height:100vh; box-sizing:border-box; color:var(--paper-ink); background:var(--paper); font:14px/1.5 var(--sans); }
.preview.dark { --paper:#101217; --paper-ink:#e8eaee; --paper-muted:#adb3bd; --paper-line:#343943; }
.preview.colorful { --paper:#f4f1ec; }
.preview-heading { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; }
.preview-heading strong { font-size:18px; font-weight:600; }
.preview-heading p { margin:6px 0 0; color:var(--paper-muted); }
.preview-heading > span { white-space:nowrap; border:1px solid var(--paper-line); border-radius:6px; padding:5px 9px; font-size:12px; }
.workspace { position:relative; margin:32px 0 0; min-height:460px; overflow:hidden; border:1px solid var(--paper-line); border-radius:12px; }
.colorful .workspace { background:linear-gradient(125deg,#f7c786,#b2b3e3 48%,#84bbac); }
.document { padding:30px; }
.eyebrow { color:var(--paper-muted); font-size:12px; }
.document h2 { font-size:28px; letter-spacing:-.6px; margin:12px 0 4px; }
.document p { color:var(--paper-muted); margin:0 0 24px; }
.document-row { display:flex; gap:18px; align-items:center; height:30px; font:11px var(--mono); color:var(--paper-muted); }
.document-row i { display:block; height:6px; width:25%; max-width:220px; background:var(--paper-line); border-radius:3px; }
.document-row:nth-child(2n) i { width:40%; }
.window-preview { position:absolute; right:8%; bottom:32px; max-width:100%; }
.preview-note { font-size:12px; color:var(--paper-muted); margin:14px 0 0; }
@media (max-width:600px) { .preview { padding:16px; } .preview-heading { flex-wrap:wrap; gap:12px; } .window-preview { right:0; } .document { padding:20px; } }
</style>
