<script setup lang="ts">
import { ref } from 'vue';
import AvatarSetPicker from './AvatarSetPicker.vue';
import AccentPalettePicker from './AccentPalettePicker.vue';
import Bubble from './Bubble.vue';
import VoiceAvatar from './VoiceAvatar.vue';
import { AVATAR_SETS, AVATAR_VOICES } from '../avatars/catalog';
import { useAvatarSet } from '../composables/useAvatarSet';
defineProps<{ layout: 'split' | 'preview-first' | 'workbench' | 'combined' }>();
const previewVoice = ref('lux');
const { avatarSet, selectAvatarSet } = useAvatarSet();
</script>
<template>
  <main class="appearance" :class="layout">
    <header><h1>Settings</h1><nav aria-label="Settings sections"><span>Audio</span><span>Sounds</span><strong>Appearance</strong><span>System</span></nav></header>
    <div class="layout">
      <section class="accent"><AccentPalettePicker /></section>
      <section v-if="layout === 'combined'" class="avatars original-avatars"><AvatarSetPicker /></section>
      <section v-else class="avatars">
        <h2>Voice avatars</h2><p>Give each voice a familiar face.</p>
        <div class="families" role="group" aria-label="Avatar style">
          <button v-for="set in AVATAR_SETS" :key="set.id" :aria-pressed="avatarSet === set.id" @click="selectAvatarSet(set.id)">

            <span>{{ set.name }}</span>
          </button>
        </div>
        <p class="gallery-hint">Every voice in this style. Select a portrait to preview it in the conversation.</p>
        <div class="all-voices" role="group" aria-label="All voice avatars">
          <button v-for="voice in AVATAR_VOICES" :key="voice" :aria-label="`Preview ${voice}`" :aria-pressed="previewVoice === voice" @click="previewVoice = voice"><VoiceAvatar :voice="voice" :size="52" /><span>{{ voice }}</span></button>
        </div>
      </section>
      <aside class="preview" aria-label="Live conversation preview">
        <div class="preview-heading"><span>Conversation preview</span><span class="live">Live preview</span></div>
        <div class="conversation">
          <Bubble side="left" accent="amber" who="You" text="Can you fix the search and run the tests?" status-kind="off" status-label="" time="" compact />
          <Bubble side="right" accent="violet" who="Claude" :voice="previewVoice" text="Both tests pass. The fix is ready for review." status-kind="off" status-label="" time="" compact />
          <Bubble side="left" accent="amber" who="You" text="Perfect. Let's ship it." status-kind="off" status-label="" time="" compact />
        </div>
        <p class="preview-note">Your accent and avatar choices appear here immediately.</p>
      </aside>
    </div>
  </main>
</template>
<style scoped>
.appearance { height:100dvh; overflow:auto; padding:28px; max-width:1160px; margin:auto; color:var(--ink); }
h1 { font-size:22px; margin-bottom:16px; } h2 { font-size:16px; font-weight:600; }
nav { display:flex; gap:24px; border-bottom:1px solid var(--line); margin-bottom:24px; color:var(--muted); }
nav span, nav strong { padding:0 0 12px; font-size:13px; } nav strong { color:var(--ink); border-bottom:2px solid var(--amber); }
.layout { display:grid; grid-template-columns:minmax(360px,1.3fr) minmax(320px,1fr); gap:0 32px; align-items:start; }
.accent { grid-column:1; grid-row:1; } .avatars { grid-column:1; grid-row:2; min-width:0; }
p { font-size:12px; color:var(--muted); margin:6px 0 16px; }
.families { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.families button { display:flex; flex-direction:column; align-items:flex-start; gap:8px; padding:12px; color:var(--ink); background:var(--bg1); border:1px solid var(--line); border-radius:10px; font-size:12px; text-align:left; }
.families button[aria-pressed=true] { border-color:var(--amber); background:var(--accent-surface); }

.preview { grid-column:2; grid-row:1 / span 2; position:sticky; top:0; background:var(--bg1); border:1px solid var(--line); border-radius:16px; padding:20px; }
.preview-heading { display:flex; justify-content:space-between; gap:12px; font-size:12px; margin-bottom:24px; }
.live { color:var(--muted); font-size:11px; }
.conversation { display:flex; flex-direction:column; gap:18px; }
.preview-note { margin:24px 0 0; font-size:11px; }
.gallery-hint { margin:20px 0 12px; }
.all-voices { display:grid; grid-template-columns:repeat(auto-fill,minmax(72px,1fr)); gap:8px; }
.all-voices button { display:grid; justify-items:center; gap:6px; padding:8px 4px; font-size:11px; color:var(--muted); background:transparent; border:1px solid transparent; border-radius:10px; }
.all-voices button:hover { background:var(--surface-hover); }
.all-voices button[aria-pressed=true] { border-color:var(--amber); background:var(--accent-surface); color:var(--ink); }
.preview-first { max-width:1000px; }
.preview-first .layout { grid-template-columns:minmax(240px,.7fr) minmax(320px,1.3fr); gap:24px; }
.preview-first .preview { grid-column:1 / -1; grid-row:1; position:static; }
.preview-first .conversation { display:grid; grid-template-columns:1fr 1.2fr 1fr; align-items:start; gap:18px; }
.preview-first .preview-note { margin-top:16px; }
.preview-first .accent { grid-row:2; } .preview-first .avatars { grid-column:2; grid-row:2; }
:is(.workbench, .combined) .layout { grid-template-columns:minmax(0,1fr); }
:is(.workbench, .combined) .accent { grid-row:1; grid-column:1; }
:is(.workbench, .combined) .preview { grid-row:2; grid-column:1; position:static; margin-bottom:24px; }
:is(.workbench, .combined) .conversation { max-width:600px; margin:auto; }
:is(.workbench, .combined) .avatars { grid-row:3; grid-column:1; }
:is(.workbench, .combined) .families { grid-template-columns:repeat(4,minmax(0,1fr)); }
@media(max-width:740px) {
  .appearance { padding:18px; }
  .layout, .preview-first .layout { display:flex; flex-direction:column; gap:24px; }
  .preview, .preview-first .preview { order:-1; position:static; width:100%; }
  .accent, .avatars { width:100%; }
  .preview-first .conversation { display:flex; }
  :is(.workbench, .combined) .families { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
</style>
