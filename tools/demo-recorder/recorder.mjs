import { TURNS, presentationEvents, transcriptsAt, activeClipAt } from './timeline.mjs';

const $ = id => document.getElementById(id);
const video = $('video');
let phase = 'idle';
let stream, context, pcm, source, socket, recorder, currentAudio;
let origin = null;
let events = [];
let offsets = {};
let chunks = [];
let takeBlob, takeURL, takeName;
let turn = 0;
let listening = false;
let takeDurationMs = 0;
let downloadedVideo = true, downloadedTiming = true;
let awaitingReady, awaitingFinal;
let reviewClip = null;
let reviewAudio;
let lastReviewTime = -1;
let finalizing = false;

const clock = () => origin === null ? 0 : performance.now() - origin;
const recording = () => phase === 'recording';
const identity = () => `u${turn + 1}`;
const status = text => { $('status').textContent = text; };
function error(text) { $('error').textContent = text; }
function log(type, detail = {}) {
  events.push({ sequence: events.length, atMs: clock(), type, ...detail });
  $('event-count').textContent = String(events.length);
  $('journal').textContent = JSON.stringify(events.slice(-15), null, 2);
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  // Callers may wait only after headphone playback finishes.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

async function within(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

function setPhase(next) {
  phase = next;
  $('state').textContent = { idle: 'Ready', preparing: 'Preparing', recording: 'Recording', stopping: 'Saving take', review: 'Review' }[next];
  $('record').disabled = !['idle', 'review'].includes(next);
  $('stop').disabled = next !== 'recording';
  $('next').disabled = next !== 'recording' || !listening;
  $('import').disabled = !['idle', 'review'].includes(next);
}

async function connectTranscription() {
  const { websocketPort } = await (await fetch('/config.json')).json();
  socket = new WebSocket(`ws://127.0.0.1:${websocketPort}`);
  const opened = deferred();
  socket.onopen = () => opened.resolve();
  socket.onerror = () => opened.reject(new Error('Cannot connect to the local transcription bridge.'));
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.type === 'ready') awaitingReady?.resolve();
    if (message.type === 'transcript') {
      if (origin !== null && ['recording', 'stopping'].includes(phase)) {
        log('transcript', { utterance: message.utterance, text: message.text, final: message.final });
        renderTranscript(clock());
      }
      if (message.final) awaitingFinal?.resolve();
    }
    if (message.type === 'error') transcriptionFailed(message.message);
  };
  socket.onclose = () => {
    if (phase === 'preparing' || recording()) transcriptionFailed('Transcription connection closed. Stop and save this take before retrying.');
  };
  await within(opened.promise, 5000, 'Local transcription bridge timed out.');
}

function transcriptionFailed(message) {
  listening = false;
  $('next').disabled = true;
  error(message);
  if (origin !== null && recording()) log('transcription-error', { message });
  awaitingReady?.reject(new Error(message));
  awaitingFinal?.reject(new Error(message));
}

async function openUtterance() {
  awaitingReady = deferred();
  awaitingFinal = deferred();
  socket.send(JSON.stringify({ type: 'start', utterance: identity(), sampleRate: context.sampleRate }));
  await within(awaitingReady.promise, 8000, 'The speech provider did not become ready. Check STT credentials.');
}

function promptUser() {
  log('user-start', { utterance: identity(), prompt: TURNS[turn].prompt, voice: TURNS[turn].agent });
  $('turn-label').textContent = `YOUR TURN ${turn + 1} / ${TURNS.length} · TALKING TO ${TURNS[turn].agent.toUpperCase()}`;
  $('prompt').textContent = `“${TURNS[turn].prompt}”`;
  $('guidance').textContent = 'Say this naturally. Press Space when you have finished; keep the recording running while you listen.';
  listening = true;
  $('next').disabled = false;
  status('Microphone → live transcription. The camera and microphone are recording continuously.');
}

async function startTake() {
  if (!['idle', 'review'].includes(phase)) return;
  if (takeBlob && (!downloadedVideo || !downloadedTiming) && !confirm('The current take has not been fully downloaded. Replace it?')) return;
  setPhase('preparing');
  error('');
  video.pause();
  pauseReview();
  origin = null;
  turn = 0;
  finalizing = false;
  $('save-video').disabled = true;
  $('save-timing').disabled = true;
  $('offsets').textContent = 'Available after recording.';
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !window.AudioWorkletNode) {
      throw new Error('Use a current Chrome browser on localhost: camera, MediaRecorder and AudioWorklet are required.');
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    for (const track of stream.getTracks()) track.onended = () => {
      if (recording()) { error('A recording device disconnected. The captured portion has been kept.'); stopTake(); }
    };
    video.srcObject = stream;
    video.controls = false;
    video.muted = true;
    await video.play();
    $('camera-placeholder').hidden = true;
    context = new AudioContext();
    await context.resume();
    await context.audioWorklet.addModule('/pcm-worklet.js');
    source = context.createMediaStreamSource(stream);
    pcm = new AudioWorkletNode(context, 'recorder-pcm');
    source.connect(pcm);
    // The worklet's output is silence: never monitor the microphone in speakers.
    pcm.connect(context.destination);
    pcm.port.onmessage = ({ data }) => {
      if (recording() && listening && socket?.readyState === WebSocket.OPEN) {
        if (socket.bufferedAmount > 1024 * 1024) {
          transcriptionFailed('Transcription cannot keep up. Stop and save this take before retrying.');
          return;
        }
        socket.send(data);
      }
    };
    await connectTranscription();
    status('Opening streaming transcription…');
    await openUtterance();
    for (let count = 3; count > 0; count--) {
      $('prompt').textContent = `Starting in ${count}…`;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4']
      .find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
    recorder.onstop = keepTake;
    recorder.onerror = () => { error('Recording failed. Keeping the captured portion.'); stopTake(); };
    recorder.onstart = () => {
      events = [];
      offsets = {};
      origin = performance.now();
      takeName = `crew-${new Date().toISOString().replaceAll(':', '-')}`;
      setPhase('recording');
      $('record').blur();
      log('recording-start', { sampleRate: context.sampleRate });
      promptUser();
    };
    chunks = [];
    recorder.start(1000);
  } catch (exception) {
    setPhase(takeBlob ? 'review' : 'idle');
    releaseDevices();
    error(exception.message);
    if (takeBlob) restoreReview();
  }
}

async function playReply(reply) {
  if (!recording()) return;
  if (reply.handover) {
    log('camera-zoom', { target: 'avatar-rail' });
    await new Promise(resolve => setTimeout(resolve, 900));
    if (!recording()) return;
    log('agent-switch', { voice: reply.voice });
  }
  $('prompt').textContent = reply.text;
  $('turn-label').textContent = `${reply.voice.toUpperCase()} IS ANSWERING`;
  currentAudio = new Audio(`/clips/${reply.clip}.mp3`);
  const audio = currentAudio;
  const ended = deferred();
  audio.onplaying = () => { log('agent-start', reply); };
  audio.onended = () => { log('agent-end', { clip: reply.clip }); ended.resolve(); };
  audio.onerror = () => ended.reject(new Error(`Cannot play ${reply.voice}'s recording. Stop and keep this take.`));
  // Stop can interrupt playback without leaving this workflow waiting forever.
  audio.onpause = () => { if (!recording()) ended.resolve(); };
  await audio.play();
  await within(ended.promise, 30000, 'Agent playback timed out. Stop and keep this take.');
  if (reply.handover && recording()) log('camera-reset');
}

async function finishTurn() {
  if (!recording() || !listening || finalizing) return;
  listening = false;
  $('next').disabled = true;
  log('user-end', { utterance: identity() });
  socket.send(JSON.stringify({ type: 'finish' }));
  const finalText = within(awaitingFinal.promise, 13000, 'Final transcript timed out. Stop and keep this take.');
  finalText.catch(() => {});
  try {
    for (const reply of TURNS[turn].replies) {
      await playReply(reply);
      if (!recording()) return;
      await new Promise(resolve => setTimeout(resolve, 650));
    }
    status('Finishing this transcript…');
    await finalText;
    if (!recording()) return;
    turn += 1;
    if (turn === TURNS.length) { stopTake(); return; }
    await openUtterance();
    if (recording()) promptUser();
  } catch (exception) {
    if (recording()) { log('take-error', { message: exception.message }); error(exception.message); }
  }
}

function stopTake() {
  if (!recording() || finalizing) return;
  finalizing = true;
  log('recording-stop');
  takeDurationMs = clock();
  listening = false;
  setPhase('stopping');
  currentAudio?.pause();
  if (recorder?.state !== 'inactive') recorder.stop();
  releaseDevices();
}

function releaseDevices() {
  listening = false;
  socket?.close();
  source?.disconnect();
  pcm?.disconnect();
  context?.close().catch(() => {});
  stream?.getTracks().forEach(track => track.stop());
  video.srcObject = null;
}

function keepTake() {
  takeBlob = new Blob(chunks, { type: recorder.mimeType });
  downloadedVideo = false;
  downloadedTiming = false;
  restoreReview();
}

function restoreReview() {
  reviewClip = null;
  lastReviewTime = -1;
  if (takeURL) URL.revokeObjectURL(takeURL);
  takeURL = URL.createObjectURL(takeBlob);
  video.srcObject = null;
  video.src = takeURL;
  video.controls = true;
  video.muted = false;
  $('camera-placeholder').hidden = true;
  setPhase('review');
  $('prompt').textContent = 'Review your take.';
  $('guidance').textContent = 'Play the video to review your microphone and the agent clips together. Adjust only the transcript timing below.';
  $('turn-label').textContent = 'RECORDING KEPT IN THIS BROWSER';
  $('save-video').disabled = false;
  $('save-timing').disabled = false;
  status(`${(takeDurationMs / 1000).toFixed(1)} seconds · ${events.length} events. Download both files before closing.`);
  $('event-count').textContent = String(events.length);
  $('journal').textContent = JSON.stringify(events.slice(-15), null, 2);
  renderOffsets();
  renderTranscript(0);
}

function renderOffsets() {
  $('offsets').replaceChildren();
  for (const event of events.filter(event => event.type === 'user-start')) {
    const label = document.createElement('label');
    const text = document.createElement('span');
    text.textContent = `${event.utterance}: “${event.prompt}”`;
    const input = document.createElement('input');
    input.type = 'number'; input.step = '50'; input.min = '-5000'; input.max = '5000';
    input.value = offsets[event.utterance] ?? 0;
    input.setAttribute('aria-label', `${event.utterance} transcript offset in milliseconds`);
    input.oninput = () => {
      offsets[event.utterance] = Math.min(5000, Math.max(-5000, Number(input.value) || 0));
      downloadedTiming = false;
      renderTranscript(video.currentTime * 1000);
    };
    label.append(text, input, document.createTextNode('ms'));
    $('offsets').append(label);
  }
}

function renderTranscript(timeMs) {
  const lines = transcriptsAt(events, timeMs, offsets);
  $('transcript').replaceChildren();
  for (const line of lines) {
    const p = document.createElement('p');
    const small = document.createElement('small'); small.textContent = line.utterance;
    p.append(small, document.createTextNode(line.text));
    $('transcript').append(p);
  }
  if (!lines.length) $('transcript').textContent = 'Waiting for transcript…';
}

function pauseReview() { reviewAudio?.pause(); }
function reviewTick() {
  if (phase !== 'review') return;
  const timeMs = video.currentTime * 1000;
  if (timeMs !== lastReviewTime) { renderTranscript(timeMs); lastReviewTime = timeMs; }
  const clip = activeClipAt(events, timeMs);
  if (!clip || video.paused || video.seeking) { pauseReview(); return; }
  if (reviewClip !== clip.sequence) {
    pauseReview();
    reviewClip = clip.sequence;
    reviewAudio = new Audio(`/clips/${clip.clip}.mp3`);
  }
  const target = (timeMs - clip.atMs) / 1000;
  if (Math.abs(reviewAudio.currentTime - target) > 0.15) reviewAudio.currentTime = target;
  reviewAudio.playbackRate = video.playbackRate;
  reviewAudio.muted = video.muted;
  reviewAudio.volume = video.volume;
  if (reviewAudio.paused) reviewAudio.play().catch(() => error('Agent audio was blocked. Click Play again.'));
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

$('record').onclick = startTake;
$('next').onclick = finishTurn;
$('stop').onclick = stopTake;
$('save-video').onclick = () => {
  download(takeBlob, `${takeName}.${takeBlob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  downloadedVideo = true;
};
$('save-timing').onclick = () => {
  const take = {
    version: 1, name: takeName, durationMs: takeDurationMs,
    clock: 'milliseconds since MediaRecorder start event; browser arrival times, not provider word timestamps',
    media: { mimeType: takeBlob.type, audio: 'microphone only; agent clips are separate assets' },
    transcriptOffsetsMs: offsets, events, presentation: presentationEvents(events, offsets),
  };
  download(new Blob([JSON.stringify(take, null, 2)], { type: 'application/json' }), `${takeName}.json`);
  downloadedTiming = true;
};
$('import').onchange = async ({ target }) => {
  if (!['idle', 'review'].includes(phase)) return;
  try {
    const files = [...target.files];
    const json = files.find(file => file.name.endsWith('.json'));
    const media = files.find(file => /\.(webm|mp4)$/i.test(file.name));
    if (!json || !media) throw new Error('Select both the video and its timing JSON.');
    const take = JSON.parse(await json.text());
    if (take.version !== 1 || !Array.isArray(take.events) || !Number.isFinite(take.durationMs)
        || !take.events.every(event => Number.isFinite(event.atMs) && Number.isInteger(event.sequence))) {
      throw new Error('This is not a supported recorder timing file.');
    }
    if (takeBlob && (!downloadedVideo || !downloadedTiming) && !confirm('Replace the unsaved take?')) return;
    pauseReview();
    events = take.events;
    offsets = take.transcriptOffsetsMs ?? {};
    takeName = take.name;
    takeDurationMs = take.durationMs;
    takeBlob = media;
    downloadedVideo = true; downloadedTiming = true;
    error(''); restoreReview();
  } catch (exception) { error(exception.message); }
  finally { target.value = ''; }
};

document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || /INPUT|TEXTAREA|VIDEO|SUMMARY/.test(event.target.tagName)) return;
  if (event.target === $('stop')) return;
  if (recording()) { event.preventDefault(); finishTurn(); }
});
window.addEventListener('beforeunload', event => {
  if (recording() || phase === 'preparing' || (takeBlob && (!downloadedVideo || !downloadedTiming))) {
    event.preventDefault(); event.returnValue = '';
  }
});
video.addEventListener('pause', pauseReview);
video.addEventListener('seeking', pauseReview);
setInterval(() => {
  const ms = recording() ? clock() : video.currentTime * 1000;
  $('clock').textContent = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${(ms / 1000 % 60).toFixed(1).padStart(4, '0')}`;
  reviewTick();
}, 50);
