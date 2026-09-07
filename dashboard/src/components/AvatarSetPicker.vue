<script setup lang="ts">
import { AVATAR_SETS, AVATAR_VOICES } from '../avatars/catalog';
import { useAvatarSet } from '../composables/useAvatarSet';
import VoiceAvatar from './VoiceAvatar.vue';
const { avatarSet, selectAvatarSet } = useAvatarSet();
const sampleVoices = ['iris', 'celeste', 'rex', 'lux', 'aurora', 'liora'];
</script>

<template>
  <fieldset class="avatar-picker">
    <legend>Voice avatars</legend>
    <p>Choose how voices look in the dashboard and companion. Your choice is saved on this device.</p>
    <div class="avatar-browser">
    <div class="avatar-options">
      <label v-for="set in AVATAR_SETS" :key="set.id" class="avatar-option" :class="{ selected: avatarSet === set.id }">
        <span class="option-heading"><input type="radio" name="avatar-set" :value="set.id" :checked="avatarSet === set.id" @change="selectAvatarSet(set.id)"><strong>{{ set.name }}</strong></span>
        <span class="sample-avatars"><VoiceAvatar v-for="voice in sampleVoices" :key="voice" :voice="voice" :set="set.id" :size="44" /></span>
      </label>
    </div>
    <div class="all-avatars" aria-label="All voices in the selected avatar family">
      <div v-for="voice in AVATAR_VOICES" :key="voice" class="voice-preview">
        <VoiceAvatar :voice="voice" :size="64" />
        <span>{{ voice }}</span>
      </div>
    </div>
    </div>
  </fieldset>
</template>

<style scoped>
.avatar-picker { border:0; padding:0; min-width:0; color:var(--ink); }
legend { font-size:16px; font-weight:600; }
p { color:var(--muted); font-size:12px; margin:8px 0 16px; }
.avatar-browser { display:grid; grid-template-columns:minmax(280px,2fr) minmax(0,3fr); gap:24px; height: min(680px, calc(100dvh - 320px)); min-height:300px; }
.avatar-options { display:flex; flex-direction:column; gap:12px; overflow-y:auto; min-height:0; padding:2px 8px 2px 2px; }
.avatar-option { flex:none; display:grid; gap:8px; padding:10px; background:var(--bg1); border:1px solid var(--line); border-radius:10px; cursor:pointer; }
.avatar-option.selected { border-color:var(--cyan); }
.option-heading { display:flex; align-items:center; gap:8px; font-size:13px; }
.sample-avatars { display:flex; gap:4px; flex-wrap:wrap; }
.option-heading input { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
.avatar-option:focus-within { outline:2px solid var(--cyan); outline-offset:2px; }
.all-avatars { display:grid; grid-template-columns:repeat(auto-fill,minmax(72px,1fr)); gap:8px; align-content:start; overflow-y:auto; min-height:0; padding:2px 8px; }
.voice-preview { display:grid; justify-items:center; gap:4px; font-size:12px; color:var(--muted); }
@media (max-width:760px) { .avatar-browser { grid-template-columns:1fr; height:auto; } .avatar-options { max-height:340px; } .all-avatars { overflow:visible; } }
</style>
