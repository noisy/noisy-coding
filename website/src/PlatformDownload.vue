<script setup lang="ts">
import { computed, ref, watch } from 'vue';
const props = withDefaults(defineProps<{ platform: 'mac' | 'windows' | 'linux'; downloadUrl?: string; compact?: boolean }>(), { platform: 'mac' });
const emit = defineEmits<{ 'update:platform': [platform: 'mac' | 'windows' | 'linux']; notify: [details: { platform: string; email: string }] }>();
const selected = ref(props.platform);
watch(() => props.platform, value => { selected.value = value; });
watch(selected, value => emit('update:platform', value));
const email = ref('');
const platforms = [{ id: 'mac', label: 'macOS' }, { id: 'windows', label: 'Windows' }, { id: 'linux', label: 'Linux' }] as const;
const name = computed(() => platforms.find(platform => platform.id === selected.value)!.label);
function notify() { emit('notify', { platform: selected.value, email: email.value }); }
</script>
<template>
  <section class="platform-download" :class="{ compact }" :aria-label="`Noisy Studio for ${name}`">
    <div class="platform-tabs" role="group" aria-label="Choose your platform"><button v-for="platform in platforms" :key="platform.id" :aria-pressed="selected === platform.id" @click="selected = platform.id">{{ platform.label }}</button></div>
    <template v-if="selected === 'mac'">
      <p v-if="!compact" class="platform-kicker">READY FOR YOUR MAC</p><h3 v-if="!compact">Your next conversation<br>starts here.</h3>
      <p v-if="!compact" class="platform-description">Bring Noisy Studio into your coding workflow.</p>
      <component :is="downloadUrl ? 'a' : 'button'" class="platform-primary" :href="downloadUrl" :disabled="!downloadUrl"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>Download for macOS</component>
      <p v-if="!compact" class="platform-note">Looking for another platform? Choose Windows or Linux above.</p>
    </template>
    <template v-else>
      <p v-if="!compact" class="platform-kicker">{{ name.toUpperCase() }} · COMING LATER</p><h3 v-if="!compact">Your platform.<br>Next on the horizon.</h3>
      <a v-if="compact" class="platform-primary" href="#install">Notify me about {{ name }} <span aria-hidden="true">→</span></a>
      <p v-if="compact" class="platform-note">macOS available first · {{ name }} coming later</p>
      <p v-if="!compact" class="platform-description">Noisy Studio is available for macOS first. Leave your email and we’ll let you know when the {{ name }} version is ready.</p>
      <form v-if="!compact" @submit.prevent="notify"><label :for="`notify-${selected}-${compact ? 'hero' : 'footer'}`">Email address</label><input :id="`notify-${selected}-${compact ? 'hero' : 'footer'}`" v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required><button class="platform-primary" type="submit">Notify me about {{ name }} <span aria-hidden="true">→</span></button></form>
      <p v-if="!compact" class="platform-note">A release notification for {{ name }}.</p>
      <button v-if="!compact" class="platform-secondary" @click="selected = 'mac'">Have a Mac? Download for macOS <span aria-hidden="true">↗</span></button>
    </template>
  </section>
</template>
<style scoped>
.platform-download { width:100%; max-width:470px; padding:32px; color:var(--ink); background:linear-gradient(145deg,var(--accent-surface),var(--bg1) 65%); border:1px solid var(--accent-border); border-radius:20px; font:15px/1.55 var(--sans); }
.platform-tabs { display:flex; gap:4px; padding:4px; border:1px solid var(--line); border-radius:9px; background:var(--bg0); margin-bottom:30px; }
.platform-tabs button { flex:1; padding:9px 6px; background:transparent; color:var(--muted); border:0; border-radius:6px; font:inherit; font-size:13px; cursor:pointer; }
.platform-tabs button[aria-pressed=true] { color:var(--ink); background:var(--surface-hover); }
.platform-kicker { color:var(--brand-accent); font-size:10px; font-weight:700; letter-spacing:.12em; margin:0 0 12px; }
h3 { font-size:30px; line-height:1.2; letter-spacing:-.035em; margin:0 0 16px; }
.platform-description { color:var(--muted); margin:0 0 24px; }
.platform-primary { box-sizing:border-box; display:flex; width:100%; align-items:center; justify-content:center; gap:12px; min-height:56px; border:1px solid var(--brand-accent); border-radius:9px; background:var(--brand-accent); color:var(--bg0); text-decoration:none; font:650 15px var(--sans); cursor:pointer; padding:14px; }
.platform-primary:disabled { opacity:1; cursor:default; }
.platform-note { color:var(--muted); font-size:12px; margin:14px 0 0; }
form label { display:block; font-size:12px; margin-bottom:6px; }
form input { box-sizing:border-box; width:100%; background:var(--bg0); color:var(--ink); border:1px solid var(--line-strong); border-radius:8px; padding:12px; font:inherit; margin-bottom:12px; }
.platform-secondary { padding:20px 0 0; margin-top:20px; width:100%; text-align:left; border:0; border-top:1px solid var(--line); background:transparent; color:var(--muted); font:13px var(--sans); cursor:pointer; }
button:focus-visible,input:focus-visible,a:focus-visible { outline:2px solid var(--brand-accent); outline-offset:3px; }
@media(max-width:420px) { .platform-download { padding:22px; } h3 { font-size:27px; } }
.compact { padding:0; border:0; background:none; border-radius:0; }
.compact .platform-tabs { margin-bottom:12px; }
.compact .platform-note { margin-top:10px; }
</style>
