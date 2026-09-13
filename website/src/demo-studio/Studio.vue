<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import TakeReview from './TakeReview.vue';
import { companionAt } from './preview.mjs';
import { renderAgents, bundleTake } from './artifacts.mjs';
import Companion from '@dashboard/components/Companion.vue';
import { SCENARIOS } from '../../../tools/demo-recorder/scenarios.mjs';
import heroTake from '@dashboard/components/marketing/recorded-hero/hero-recording.json';
import heroEdits from '../../../tools/demo-recorder/takes/hero-v1/presentation-edits.json';
import { recordedActivitySchedule } from '@dashboard/components/marketing/recordedActivitySchedule';
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
const agentsUrl = ref('');
const archiveUrl = ref('');
const artifacts = shallowRef(null);
const preparing = ref(false);
const reviewMs = ref(0);
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
const preview = computed(() => companionAt(events.value, scenario.value, mediaUrl.value ? reviewMs.value : Infinity));
const clockLabel = computed(() => `${Math.floor(elapsed.value / 60000).toString().padStart(2, '0')}:${Math.floor(elapsed.value / 1000 % 60).toString().padStart(2, '0')}`);
let capture, origin = 0, ticker;
function update() { revision.value++; }
function reset() {
  session.value = null; takeBlob.value = null; artifacts.value = null; reviewMs.value = 0;
  if (agentsUrl.value) URL.revokeObjectURL(agentsUrl.value);
  agentsUrl.value = '';
  if (archiveUrl.value) URL.revokeObjectURL(archiveUrl.value);
  archiveUrl.value = '';
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
      schedule: scenario.value.id === 'hero-search' ? recordedActivitySchedule(heroTake, heroEdits.turns, heroEdits.activities) : null,
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
    reviewMs.value = 0;
    await prepareAudio();
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
function takeDocument() {
  return { version: 1, name: filename.value, durationMs: duration.value, scenario: scenario.value,
    clock: 'milliseconds since MediaRecorder start event', transcriptSource: 'script; not live transcription',
    media: { mimeType: takeBlob.value?.type ?? null, audio: 'microphone only; agent clips are separate assets' },
    transcriptOffsetsMs: {}, events: events.value, presentation: events.value.map(event => ({ ...event, displayAtMs: event.atMs })) };
}
function saveTiming() {
  download(new Blob([JSON.stringify(takeDocument(), null, 2)], { type: 'application/json' }), `${filename.value}.json`); savedTiming.value = true;
}
async function reopen(event) {
  const files = [...event.target.files];
  event.target.value = '';
  const metadata = files.find(file => file.name.endsWith('.json'));
  const original = files.find(file => !file.name.endsWith('.json'));
  if (!metadata || !original) { error.value = 'Select the original recording and its timing JSON together.'; return; }
  try {
    const take = JSON.parse(await metadata.text());
    if (take.version !== 1 || !Number.isFinite(take.durationMs) || take.durationMs <= 0 || !Array.isArray(take.events) || !take.events.every(event => Number.isFinite(event.atMs) && event.atMs >= 0) || !SCENARIOS.some(s => s.id === take.scenario?.id)) throw new Error('Unsupported take');
    reset(); selected.value = take.scenario.id;
    session.value = { phase: 'done', events: take.events, stop() {} };
    duration.value = take.durationMs;
    filename.value = original.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
    takeBlob.value = original; mediaUrl.value = URL.createObjectURL(original);
    isRecording.value = true; recordingMode.value = original.type.startsWith('audio/') ? 'external' : 'camera';
    savedMedia.value = savedTiming.value = true;
    await prepareAudio();
  } catch { error.value = 'Could not open this take. Choose a Demo Studio recording and its matching timing JSON.'; }
}
async function prepareAudio() {
  preparing.value = true;
  try {
    artifacts.value = await renderAgents(events.value, duration.value, clips);
    if (agentsUrl.value) URL.revokeObjectURL(agentsUrl.value);
    agentsUrl.value = URL.createObjectURL(artifacts.value.audio);
    const archive = await bundleTake(takeBlob.value, takeDocument(), artifacts.value);
    if (archiveUrl.value) URL.revokeObjectURL(archiveUrl.value);
    archiveUrl.value = URL.createObjectURL(archive);
  } catch (e) { error.value = 'Could not prepare agent audio. Your original recording and timing can still be downloaded. ' + e.message; }
  finally { preparing.value = false; }
}
function keydown(event) {
  if (event.code !== 'Space' || event.repeat || /INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (active.value) { event.preventDefault(); void advance(); }
}
function beforeLeave(event) {
  if (active.value || busy.value || preparing.value || pendingDownloads.value) { event.preventDefault(); event.returnValue = ''; }
}
onMounted(() => { window.addEventListener('keydown', keydown); window.addEventListener('beforeunload', beforeLeave); });
onBeforeUnmount(() => {
  session.value?.stop(); clearInterval(ticker); void capture?.stop();
  if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  if (agentsUrl.value) URL.revokeObjectURL(agentsUrl.value);
  if (archiveUrl.value) URL.revokeObjectURL(archiveUrl.value);
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
          <select id="scenario" v-model="selected" :disabled="active || busy || preparing || pendingDownloads" @change="reset"><option v-for="item in SCENARIOS" :value="item.id">{{ item.title }}</option></select>
          <template v-if="!active && phase !== 'done'">
            <h2>Make yourself comfortable.</h2>
            <ol class="instructions"><li>Put on headphones to keep the other voices out of your recording.</li><li>Read the script below, then try a rehearsal.</li><li>When recording, keep the pauses. Listen naturally between your lines.</li></ol>
            <label class="field-label" for="recording-mode">How are you recording?</label>
            <select id="recording-mode" v-model="recordingMode" :disabled="busy"><option value="camera">Camera + microphone in this browser</option><option value="external">My own camera + browser microphone reference</option></select>
            <p v-if="recordingMode === 'external'" class="hint">Start your own camera first. This page records a microphone reference so we can align your original camera file afterward. Send that original too.</p>
            <div class="actions"><button class="primary" :disabled="busy" @click="start(true)">{{ busy ? 'Opening devices…' : 'Record a take' }}</button><button :disabled="busy" @click="start(false)">Rehearse first</button></div>
            <label class="reopen">Open an existing take<input aria-label="Open existing recording and timing" type="file" accept=".webm,.mp4,.json" multiple :disabled="busy" @change="reopen"></label>
          </template>
          <template v-else-if="active">
            <div class="take-status"><span>{{ isRecording ? '● RECORDING' : 'REHEARSAL' }}</span><time>{{ clockLabel }}</time></div>
            <p class="eyebrow">{{ phase === 'user' ? `YOUR LINE · ${session.turn + 1} OF ${scenario.turns.length}` : 'LISTEN & REACT' }}</p>
            <h2 class="prompt">{{ phase === 'user' ? current?.prompt : preview.activity || (preview.mode === 'claude' ? `${preview.voice[0].toUpperCase() + preview.voice.slice(1)} is replying…` : 'A short pause…') }}</h2>
            <p class="hint">{{ phase === 'user' ? 'Take your time. Press Space when you finish this line.' : 'Keep the camera rolling. Your next line appears when the reply finishes.' }}</p>
            <button class="primary next" :disabled="phase !== 'user' || busy" @click="advance">Finished speaking <kbd>Space</kbd></button>
            <div class="actions"><button @click="finish" :disabled="busy">Stop take</button><button v-if="isRecording" @click="sync">Mark sync point</button></div>
            <p v-if="isRecording" class="hint">Optional: say “sync” as you mark a point, to help align an external camera.</p>
          </template>
          <template v-else>
            <p class="eyebrow">{{ isRecording ? 'TAKE SAVED IN THIS TAB' : 'REHEARSAL FINISHED' }}</p><h2>{{ events.at(-1)?.complete ? 'That’s a wrap.' : 'Take stopped.' }}</h2><p class="hint">{{ isRecording ? 'Download the ZIP before leaving. It includes your original recording, timing, and a separate agent audio track.' : 'Ready when you are. You can rehearse again or record your take.' }}</p>
            <div v-if="takeBlob" class="actions"><a v-if="archiveUrl" class="primary download-zip" :href="archiveUrl" :download="`${filename}.zip`" @click="savedMedia = savedTiming = true">Download ZIP</a><button v-else disabled>Preparing audio & ZIP…</button><button v-if="!archiveUrl && !preparing" @click="prepareAudio">Retry audio & ZIP</button></div>
            <div class="actions" v-if="takeBlob"><button @click="saveMedia">{{ savedMedia ? '✓ ' : '' }}Download recording</button><button @click="saveTiming">{{ savedTiming ? '✓ ' : '' }}Download timing</button></div>
            <button class="new-take" :disabled="pendingDownloads || busy || preparing" @click="reset">New take</button>
          </template>
          <details class="script"><summary>Read the full script <span>{{ scenario.turns.length }} lines for you</span></summary><div v-if="scenario.intro.length" class="script-turn"><p v-for="reply in scenario.intro"><b>{{ reply.voice }}</b>{{ reply.text }}</p></div><div v-for="turn in scenario.turns" class="script-turn"><p><b>You</b>{{ turn.prompt }}</p><p v-for="reply in turn.replies"><b>{{ reply.voice }}</b>{{ reply.text }}</p></div></details>
        </section>
        <section class="preview-area" aria-label="Live companion preview">
          <div class="preview-top"><span>LIVE COMPANION</span><span>Script preview · no live transcription</span></div>
          <div class="stage"><div class="stage-caption">Your voice, in the workflow.</div><div class="companion-frame companion-window"><Companion v-bind="preview" avatar-set="editorial" follow-latest :max-height="320" /></div><div class="stage-foot">{{ active ? 'The preview follows your take.' : 'The real widget. Your next conversation.' }}</div></div>
          <video v-if="active && isRecording && recordingMode === 'camera'" ref="camera" class="camera-preview" autoplay muted playsinline aria-label="Your camera preview"></video>
          <TakeReview v-if="mediaUrl && agentsUrl" :recording="mediaUrl" :agents="agentsUrl" :camera="recordingMode === 'camera'" :duration-ms="duration" @time="reviewMs = $event" />
          <p v-else-if="mediaUrl && preparing" class="hint">Preparing synchronized conversation playback…</p>
          <p class="privacy">Camera and microphone start only when you choose Record. Your recording stays in this tab until you download it. Agent voices are added separately during editing.</p>
        </section>
      </div>
    </main>
    <footer>DEMO STUDIO <span>A little direction. A natural conversation.</span></footer>
  </div>
</template>
