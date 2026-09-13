<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import Companion from '@dashboard/components/Companion.vue';
import { SCENARIOS } from '../../../tools/demo-recorder/scenarios.mjs';
import { StudioSession, wait } from './session.mjs';
import { captureTake, download, playClip } from './media.mjs';

const assets = { ...import.meta.glob('../../../tools/demo-recorder/clips/*.mp3', { eager: true, query: '?url', import: 'default' }), ...import.meta.glob('../../../dashboard/src/components/marketing/crew-voice/*.mp3', { eager: true, query: '?url', import: 'default' }) };
const clips = Object.fromEntries(Object.entries(assets).map(([path, url]) => [path.split('/').pop().replace('.mp3', ''), url]));
const baseUrl = import.meta.env.BASE_URL;
const selected = ref('hero-search');
const scenario = computed(() => SCENARIOS.find(s => s.id === selected.value));
const session = shallowRef(null);
const revision = ref(0);
const phase = computed(() => { revision.value; return session.value?.phase ?? 'ready'; });
const busy = ref(false);
const recordingMode = ref('camera');
const isRecording = ref(false);
const error = ref('');
const camera = ref(null);
const mediaUrl = ref('');
const takeBlob = shallowRef(null);
const duration = ref(0);
const elapsed = ref(0);
const filename = ref('');
const savedMedia = ref(false);
const savedTiming = ref(false);
const pendingDownloads = computed(() => !!takeBlob.value && (!savedMedia.value || !savedTiming.value));
const active = computed(() => ['user', 'reply'].includes(phase.value));
const current = computed(() => { revision.value; return scenario.value.turns[session.value?.turn ?? 0]; });
const events = computed(() => { revision.value; return [...(session.value?.events ?? [])]; });
const preview = computed(() => {
  let voice = 'lux', mode = 'idle', activity = null, liveText = '';
  const feed = [];
  for (const event of events.value) {
    if (event.type === 'user-start') { voice = event.voice.toLowerCase(); mode = 'user'; liveText = event.prompt; }
    if (event.type === 'user-end') { feed.push({ role: 'user', text: liveText, id: event.sequence, voice }); liveText = ''; mode = 'idle'; }
    if (event.type === 'agent-start') { voice = event.voice.toLowerCase(); mode = 'claude'; feed.push({ role: 'claude', text: event.text, id: event.sequence, voice }); }
    if (event.type === 'agent-end') mode = 'idle';
    if (event.type === 'activity-start') activity = event.text;
    if (event.type === 'activity-end') activity = null;
    if (event.type === 'recording-stop') { activity = null; mode = 'idle'; liveText = ''; }
  }
  const voices = [...new Set(scenario.value.turns.flatMap(turn => [turn.agent, ...turn.replies.map(reply => reply.voice)]))];
  return { voice, mode, activity, liveText, feed: feed.filter(message => message.voice === voice), agents: voices.map(name => ({ name, label: name === 'Lux' ? 'Claude' : name, voice: name.toLowerCase(), active: voice === name.toLowerCase() })) };
});
const clockLabel = computed(() => `${Math.floor(elapsed.value / 60000).toString().padStart(2, '0')}:${Math.floor(elapsed.value / 1000 % 60).toString().padStart(2, '0')}`);
let capture, origin = 0, ticker;
function update() { revision.value++; }
function reset() {
  session.value = null; takeBlob.value = null;
  if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  mediaUrl.value = ''; elapsed.value = 0; error.value = '';
  savedMedia.value = savedTiming.value = false;
}
async function start(record) {
  if (busy.value || active.value || pendingDownloads.value) return;
  reset(); busy.value = true; isRecording.value = record;
  filename.value = `${scenario.value.id}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try {
    if (record) capture = await captureTake(recordingMode.value === 'camera', () => { origin = performance.now(); }, fail);
    else origin = performance.now();
    session.value = new StudioSession(scenario.value, {
      now: () => performance.now() - origin, update, wait,
      play: (reply, signal, started) => playClip(clips[reply.clip], signal, started),
    });
    const started = session.value.start();
    await nextTick();
    if (camera.value && capture) camera.value.srcObject = capture.stream;
    ticker = setInterval(() => { elapsed.value = performance.now() - origin; }, 100);
    await started;
  } catch (e) { await fail(e.message || 'Could not start recording. Check microphone and camera access.'); }
  finally { busy.value = false; }
}
async function advance() {
  if (phase.value !== 'user') return;
  try {
    await session.value.advance();
    if (phase.value === 'done') await finish();
  } catch (e) { await fail(e.message); }
}
async function finish() {
  if (busy.value) return;
  busy.value = true;
  session.value?.stop();
  clearInterval(ticker);
  duration.value = Math.max(0, performance.now() - origin);
  elapsed.value = duration.value;
  const recording = capture; capture = null;
  if (recording) {
    takeBlob.value = await recording.stop();
    mediaUrl.value = URL.createObjectURL(takeBlob.value);
  }
  busy.value = false;
}
async function fail(message) {
  error.value = message;
  busy.value = false;
  await finish();
}
function sync() { session.value?.log('sync-marker', { text: 'Actor synchronization marker' }); }
function saveMedia() {
  const extension = takeBlob.value.type.includes('mp4') ? 'mp4' : 'webm';
  download(takeBlob.value, `${filename.value}.${extension}`); savedMedia.value = true;
}
function saveTiming() {
  const take = { version: 1, name: filename.value, durationMs: duration.value, scenario: scenario.value,
    clock: 'milliseconds since MediaRecorder start event', transcriptSource: 'script; not live transcription',
    media: { mimeType: takeBlob.value?.type ?? null, audio: 'microphone only; agent clips are separate assets' },
    transcriptOffsetsMs: {}, events: events.value, presentation: events.value.map(event => ({ ...event, displayAtMs: event.atMs })) };
  download(new Blob([JSON.stringify(take, null, 2)], { type: 'application/json' }), `${filename.value}.json`); savedTiming.value = true;
}
function keydown(event) {
  if (event.code !== 'Space' || event.repeat || /INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (active.value) { event.preventDefault(); void advance(); }
}
function beforeLeave(event) {
  if (active.value || busy.value || pendingDownloads.value) { event.preventDefault(); event.returnValue = ''; }
}
onMounted(() => { window.addEventListener('keydown', keydown); window.addEventListener('beforeunload', beforeLeave); });
onBeforeUnmount(() => {
  session.value?.stop(); clearInterval(ticker); void capture?.stop();
  if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  window.removeEventListener('keydown', keydown); window.removeEventListener('beforeunload', beforeLeave);
});
</script>

<template>
  <div class="studio-shell">
    <header class="studio-header"><a :href="baseUrl" class="wordmark">Noisy Coding <span>/ Demo Studio</span></a><span class="private-note">Recorded here. Saved by you.</span></header>
    <main>
      <div class="intro"><p class="eyebrow">THE RECORDING ROOM</p><h1>A conversation.<br><span>Just play your part.</span></h1><p>Say your line. Press Space. Listen and react. We’ll take care of the timing.</p></div>
      <div v-if="error" role="alert" class="error">{{ error }}</div>
      <div class="workspace">
        <section class="director" aria-label="Recording controls">
          <label class="field-label" for="scenario">Your scene</label>
          <select id="scenario" v-model="selected" :disabled="active || busy || pendingDownloads" @change="reset"><option v-for="item in SCENARIOS" :value="item.id">{{ item.title }}</option></select>
          <template v-if="!active && phase !== 'done'">
            <h2>Make yourself comfortable.</h2>
            <ol class="instructions"><li>Put on headphones to keep the other voices out of your recording.</li><li>Read the script below, then try a rehearsal.</li><li>When recording, keep the pauses. Listen naturally between your lines.</li></ol>
            <label class="field-label" for="recording-mode">How are you recording?</label>
            <select id="recording-mode" v-model="recordingMode" :disabled="busy"><option value="camera">Camera + microphone in this browser</option><option value="external">My own camera + browser microphone reference</option></select>
            <p v-if="recordingMode === 'external'" class="hint">Start your own camera first. This page records a microphone reference so we can align your original camera file afterward. Send that original too.</p>
            <div class="actions"><button class="primary" :disabled="busy" @click="start(true)">{{ busy ? 'Opening devices…' : 'Record a take' }}</button><button :disabled="busy" @click="start(false)">Rehearse first</button></div>
          </template>
          <template v-else-if="active">
            <div class="take-status"><span>{{ isRecording ? '● RECORDING' : 'REHEARSAL' }}</span><time>{{ clockLabel }}</time></div>
            <p class="eyebrow">{{ phase === 'user' ? `YOUR LINE · ${session.turn + 1} OF ${scenario.turns.length}` : 'LISTEN & REACT' }}</p>
            <h2 class="prompt">{{ phase === 'user' ? current?.prompt : preview.activity || `${preview.voice[0].toUpperCase() + preview.voice.slice(1)} is replying…` }}</h2>
            <p class="hint">{{ phase === 'user' ? 'Take your time. Press Space when you finish this line.' : 'Keep the camera rolling. Your next line appears when the reply finishes.' }}</p>
            <button class="primary next" :disabled="phase !== 'user' || busy" @click="advance">Finished speaking <kbd>Space</kbd></button>
            <div class="actions"><button @click="finish" :disabled="busy">Stop take</button><button v-if="isRecording" @click="sync">Mark sync point</button></div>
            <p v-if="isRecording" class="hint">Optional: say “sync” as you mark a point, to help align an external camera.</p>
          </template>
          <template v-else>
            <p class="eyebrow">{{ isRecording ? 'TAKE SAVED IN THIS TAB' : 'REHEARSAL FINISHED' }}</p><h2>{{ events.at(-1)?.complete ? 'That’s a wrap.' : 'Take stopped.' }}</h2><p class="hint">{{ isRecording ? 'Download both files before leaving. Nothing is uploaded automatically.' : 'Ready when you are. You can rehearse again or record your take.' }}</p>
            <div class="actions" v-if="takeBlob"><button class="primary" @click="saveMedia">{{ savedMedia ? '✓ ' : '' }}Download recording</button><button @click="saveTiming">{{ savedTiming ? '✓ ' : '' }}Download timing</button></div>
            <button class="new-take" :disabled="pendingDownloads || busy" @click="reset">New take</button>
          </template>
          <details class="script"><summary>Read the full script <span>{{ scenario.turns.length }} lines for you</span></summary><div v-if="scenario.intro.length" class="script-turn"><p v-for="reply in scenario.intro"><b>{{ reply.voice }}</b>{{ reply.text }}</p></div><div v-for="turn in scenario.turns" class="script-turn"><p><b>You</b>{{ turn.prompt }}</p><p v-for="reply in turn.replies"><b>{{ reply.voice }}</b>{{ reply.text }}</p></div></details>
        </section>
        <section class="preview-area" aria-label="Live companion preview">
          <div class="preview-top"><span>LIVE COMPANION</span><span>Script preview · no live transcription</span></div>
          <div class="stage"><div class="stage-caption">Your voice, in the workflow.</div><div class="companion-frame"><Companion v-bind="preview" avatar-set="editorial" :max-height="320" /></div><div class="stage-foot">{{ active ? 'The preview follows your take.' : 'The real widget. Your next conversation.' }}</div></div>
          <video v-if="active && isRecording && recordingMode === 'camera'" ref="camera" class="camera-preview" autoplay muted playsinline aria-label="Your camera preview"></video>
          <video v-if="mediaUrl && recordingMode === 'camera'" :src="mediaUrl" class="take-review" controls playsinline aria-label="Review your original recording"></video>
          <audio v-else-if="mediaUrl" :src="mediaUrl" controls aria-label="Review microphone reference"></audio>
          <p class="privacy">Camera and microphone start only when you choose Record. Your recording stays in this tab until you download it. Agent voices are added separately during editing.</p>
        </section>
      </div>
    </main>
    <footer>DEMO STUDIO <span>A little direction. A natural conversation.</span></footer>
  </div>
</template>
