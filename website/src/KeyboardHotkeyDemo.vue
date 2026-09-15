<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import VoiceAvatar from '@dashboard/components/VoiceAvatar.vue';
import keyboardPhoto from './assets/optimized/apple-magic-keyboard.webp';

const props = withDefaults(defineProps<{ staticPreview?: boolean }>(), { staticPreview: false });
// Centers measured on the 2000 × 560 delivery crop. Keep portraits in the
// same transformed plane as the photo so registration survives every zoom.
const agents = [
  { name: 'Lux', voice: 'lux', key: 'F16', x: 83.35, role: 'Work', context: 'Website redesign', message: 'Ready to pick up where we left off.' },
  { name: 'Rex', voice: 'rex', key: 'F17', x: 87.85, role: 'Side projects', context: 'Weekend project', message: 'Your next idea has my attention.' },
  { name: 'Luna', voice: 'luna', key: 'F18', x: 92.35, role: 'Personal', context: 'Personal assistant', message: 'What can I help you with?' },
  { name: 'Celeste', voice: 'celeste', key: 'F19', x: 96.85, role: 'Research', context: 'Research notes', message: 'Let’s continue exploring.' },
];
const root = ref<HTMLElement>();
const phase = ref(props.staticPreview ? 2 : 0);
const active = ref(0);
const reducedMotion = ref(false);
const timers: ReturnType<typeof setTimeout>[] = [];
let observer: IntersectionObserver | undefined;
let motion: MediaQueryList | undefined;
function clearTimers() { timers.splice(0).forEach(clearTimeout); }
function select(index: number) { clearTimers(); phase.value = 2; active.value = index; }
function replay() {
  clearTimers(); active.value = 0;
  if (props.staticPreview || reducedMotion.value) { phase.value = 2; return; }
  phase.value = 0;
  timers.push(setTimeout(() => phase.value = 1, 1400));
  timers.push(setTimeout(() => phase.value = 2, 3200));
  [1, 2, 3].forEach((index) => timers.push(setTimeout(() => active.value = index, 4300 + index * 1500)));
}
function updateMotion() { reducedMotion.value = !!motion?.matches; if (reducedMotion.value) { clearTimers(); phase.value = 2; } }
onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  updateMotion(); motion.addEventListener('change', updateMotion);
  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { replay(); observer?.disconnect(); }
  }, { threshold: 0.3 });
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => { clearTimers(); observer?.disconnect(); motion?.removeEventListener('change', updateMotion); });
</script>

<template>
  <div ref="root" class="key-demo" :class="{ focused: phase > 0, assigned: phase > 1, 'no-motion': reducedMotion || staticPreview }">
    <div class="demo-topline"><span><i /> A SHORTCUT TO YOUR CREW</span><button @click="replay" aria-label="Replay keyboard animation">↻ Replay</button></div>
    <div class="keyboard-viewport">
      <div class="keyboard-plane">
        <img class="keyboard-photo" :src="keyboardPhoto" alt="A real Apple keyboard with F16, F17, F18 and F19 above the numeric keypad" />
        <button v-for="(agent, index) in agents" :key="agent.key" class="key-person" :class="{ selected: active === index }" :style="{ left: agent.x + '%', '--reveal-delay': index * 110 + 'ms' }" :disabled="phase < 2" :aria-label="`Select ${agent.name} with ${agent.key}`" :aria-pressed="active === index" @click="select(index)">
          <VoiceAvatar :voice="agent.voice" set="editorial" :size="100" />
        </button>
      </div>
      <div class="overview-caption" :class="{ hidden: phase > 0 }">The keyboard you already know.<br><strong>A new way to reach your agents.</strong></div>
    </div>
    <div class="demo-bottom">
      <div class="key-legend" aria-label="Example shortcut assignments">
        <button v-for="(agent, index) in agents" :key="agent.key" :class="{ selected: phase > 1 && active === index }" :aria-pressed="phase > 1 && active === index" @click="select(index)"><kbd>{{ agent.key }}</kbd><span>{{ agent.name }}<small>{{ agent.role }}</small></span></button>
      </div>
      <div class="conversation-peek" :class="{ visible: phase > 1 }">
        <VoiceAvatar :voice="agents[active].voice" set="editorial" :size="36" />
        <div><strong>{{ agents[active].context }}</strong><span>{{ agents[active].message }}</span></div><span class="active-label">Selected</span>
      </div>
    </div>
    <p class="photo-credit">Apple Magic Keyboard · illustrative shortcut overlays</p>
  </div>
</template>

<style scoped>
.key-demo { position:relative; overflow:hidden; border:1px solid #3b4147; border-radius:24px; background:radial-gradient(ellipse at 73% 25%,#303f43 0%,#1b2026 52%,#15191e 100%); color:#e9edf0; font-family:Inter, ui-sans-serif, system-ui, sans-serif; isolation:isolate; }
.demo-topline { position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center; padding:24px 28px; font-size:10px; letter-spacing:.13em; color:#9eafb6; }
.demo-topline span { display:flex; gap:9px; align-items:center; }.demo-topline i { width:6px; height:6px; border-radius:50%; background:#83cbbb; box-shadow:0 0 14px #83cbbb80; }
button { font:inherit; cursor:pointer; }.demo-topline button { background:#ffffff06; color:#bfcbcf; border:1px solid #ffffff17; border-radius:20px; padding:8px 13px; font-size:11px; letter-spacing:0; }
.keyboard-viewport { position:relative; height:350px; overflow:hidden; }
.keyboard-plane { position:absolute; width:94%; left:3%; top:27%; transform-origin:90% 10.7%; transition:transform 1.8s cubic-bezier(.22,.7,.15,1); }
.focused .keyboard-plane { transform:translateX(-32%) scale(2.65); }
.keyboard-photo { display:block; width:100%; height:auto; border-radius:12px; box-shadow:0 25px 40px #0008; }
.key-person { position:absolute; top:10.7%; width:3.65%; aspect-ratio:1; transform:translate(-50%,-50%) scale(.7); opacity:0; padding:0; border:1px solid #afc2cc; border-radius:13%; box-sizing:border-box; box-shadow:0 3px 5px #0007; background:#202a2d; transition:opacity .45s, transform .6s, border-color .3s; transition-delay:var(--reveal-delay); }
.key-person :deep(.voice-avatar) { width:100% !important; height:100% !important; display:block; border-radius:inherit; }
.assigned .key-person { opacity:1; transform:translate(-50%,-50%) scale(1); }
.key-person.selected { border-color:#96e2d1; box-shadow:0 0 0 1px #96e2d1,0 0 10px #71c7b678,0 3px 6px #0009; }.key-person:focus-visible { outline:2px solid white; outline-offset:3px; }
.overview-caption { position:absolute; top:0; left:28px; font-size:14px; line-height:1.6; color:#9eafb6; transition:opacity .4s; }.overview-caption strong { color:#e1e9e8; font-weight:500; }.overview-caption.hidden { opacity:0; }
.demo-bottom { position:relative; z-index:2; padding:0 28px 12px; background:linear-gradient(transparent,#15191e 18%); }
.key-legend { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:14px 0; }.key-legend button { display:flex; align-items:center; gap:10px; text-align:left; color:#bac3c8; background:transparent; border:1px solid transparent; border-radius:12px; padding:10px 8px; transition:background .3s; }.key-legend button.selected { background:#83cbbb12; border-color:#83cbbb45; color:#e9fffa; }.key-legend kbd { border:1px solid #536067; border-bottom-width:3px; border-radius:6px; padding:7px 5px; font:11px ui-monospace,monospace; color:#a9dcd1; }.key-legend span { font-size:13px; font-weight:600; }.key-legend small { display:block; font-size:10px; font-weight:400; color:#93a2ab; margin-top:3px; white-space:nowrap; }
.conversation-peek { display:flex; align-items:center; gap:12px; border-top:1px solid #ffffff13; padding-top:16px; opacity:0; transition:opacity .6s; min-height:56px; }.conversation-peek.visible { opacity:1; }.conversation-peek div { flex:1; }.conversation-peek strong { display:block; color:#b6b8f4; font-size:12px; font-weight:600; }.conversation-peek div span { display:block; margin-top:4px; font-size:12px; color:#a4afb8; }.active-label { font-size:10px; color:#88cbbb; }
.photo-credit { margin:6px 28px 16px; color:#74818c; font-size:9px; }.photo-credit a { color:inherit; }.no-motion *, .no-motion .keyboard-plane { transition:none !important; }
@media(max-width:600px) { .demo-topline { padding:18px; font-size:8px; }.keyboard-viewport { height:230px; }.keyboard-plane { top:40%; }.focused .keyboard-plane { transform:translateX(-33%) scale(3.2); }.overview-caption { left:18px; font-size:12px; }.demo-bottom { padding:0 12px 10px; }.key-legend { gap:0; }.key-legend button { flex-direction:column; gap:5px; align-items:center; padding:8px 2px; }.key-legend small { font-size:8px; }.key-legend span { font-size:11px; }.conversation-peek { gap:8px; }.conversation-peek div span { font-size:10px; }.active-label { display:none; }.photo-credit { margin-inline:18px; font-size:8px; } }
</style>
