import { validateEdits, validateRange } from './audio-edits.mjs';
const $ = id => document.getElementById(id);
const video = $('video');
let source, edits, mediaURL, peaks;
let dirty = false, editing = null, auditionEnd = null, loadRequest = 0;
let selection = { startMs: 0, endMs: 0 };
const error = message => { $('error').textContent = message; };
const clockMs = () => Math.min(source?.durationMs ?? 0, Math.round(video.currentTime * 1000));
const cacheKey = () => `demo-audio-edits:${source.sha256}`;
const label = range => `${range.startMs}–${range.endMs} ms · ${range.endMs - range.startMs} ms`;
function changed(next) {
  edits = validateEdits(next, source);
  dirty = true;
  try { localStorage.setItem(cacheKey(), JSON.stringify(edits)); } catch { /* Downloads remain available if browser storage is full. */ }
  renderMarkers(); drawWave(); error('');
  $('status').textContent = 'Markers changed. Save the JSON before closing.';
}
function useSelection(range) {
  selection = { ...range };
  $('start').value = selection.startMs; $('end').value = selection.endMs;
  const duration = source?.durationMs || 1;
  $('selection').style.left = `${selection.startMs / duration * 100}%`;
  $('selection').style.width = `${Math.max(0, selection.endMs - selection.startMs) / duration * 100}%`;
}
function readSelection() {
  return validateRange({ startMs: Number($('start').value), endMs: Number($('end').value) }, source.durationMs);
}
function cancelEdit() { editing = null; $('add').textContent = 'Add repair interval'; $('cancel-edit').hidden = true; }
function attempt(action) { try { action(); error(''); } catch (exception) { error(exception.message); } }
async function audition(range = readSelection()) {
  validateRange(range, source.durationMs);
  auditionEnd = range.endMs;
  useSelection(range);
  video.currentTime = range.startMs / 1000;
  try { await video.play(); } catch { auditionEnd = null; error('Playback was blocked. Use the video Play button and try again.'); }
}
function button(text, action, className = '') {
  const node = document.createElement('button'); node.type = 'button'; node.textContent = text; node.className = className;
  node.onclick = () => attempt(action); return node;
}
function markerRow(range, index) {
  const row = document.createElement(index === null ? 'div' : 'li'); row.className = 'marker-row';
  const text = document.createElement('span'); text.textContent = label(range); row.append(text);
  row.append(button('Listen', () => void audition(range)), button('Adjust', () => {
    useSelection(range); video.currentTime = range.startMs / 1000; showPlayhead();
    editing = index === null ? 'background' : index;
    $('add').textContent = index === null ? 'Add repair interval' : 'Update repair interval';
    $('cancel-edit').hidden = false;
  }), button('Remove', () => {
    changed(index === null ? {...edits, roomTone: null} : {...edits, repairs: edits.repairs.filter((_, i) => i !== index)});
    cancelEdit();
  }, 'remove'));
  return row;
}
function renderMarkers() {
  $('repairs').replaceChildren(...edits.repairs.map((range, i) => markerRow(range, i)));
  $('count').textContent = edits.repairs.length;
  $('room-tone').replaceChildren();
  if (edits.roomTone) $('room-tone').append(markerRow(edits.roomTone, null));
  else $('room-tone').textContent = 'No sample selected.';
}
function drawWave() {
  if (!source || !peaks) return;
  const width = Math.round($('wave-scroll').clientWidth * Number($('zoom').value));
  $('wave-stage').style.width = `${width}px`;
  const canvas = $('wave'); canvas.width = width; canvas.height = 170;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, 170);
  for (const range of edits.repairs) {
    ctx.fillStyle = '#d69b6133'; ctx.fillRect(range.startMs / source.durationMs * width, 0, (range.endMs - range.startMs) / source.durationMs * width, 170);
  }
  if (edits.roomTone) {
    ctx.fillStyle = '#6cd7a433'; ctx.fillRect(edits.roomTone.startMs / source.durationMs * width, 0, (edits.roomTone.endMs - edits.roomTone.startMs) / source.durationMs * width, 170);
  }
  ctx.strokeStyle = '#cbb8ed'; ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const peak = peaks[Math.min(peaks.length - 1, Math.floor(x / width * peaks.length))];
    const height = Math.max(.5, Math.min(76, peak * Number($('gain').value) * 76));
    ctx.moveTo(x + .5, 85 - height); ctx.lineTo(x + .5, 85 + height);
  }
  ctx.stroke(); updateRuler(); useSelection(selection);
}
function updateRuler() {
  if (!source) return;
  const viewport = $('wave-scroll'); const width = $('wave-stage').clientWidth;
  $('ruler').replaceChildren(...Array.from({length: 5}, (_, i) => {
    const node = document.createElement('span');
    node.textContent = `${Math.round((viewport.scrollLeft + viewport.clientWidth * i / 4) / width * source.durationMs)} ms`;
    return node;
  }));
}
function showPlayhead() {
  if (!source) return;
  const x = clockMs() / source.durationMs * $('wave-stage').clientWidth;
  $('wave-scroll').scrollLeft = x - $('wave-scroll').clientWidth / 2;
}
async function loadMedia(file) {
  if (!file) return;
  if (dirty && !confirm('Replace these unsaved markers? Download them first if you need a separate copy.')) return;
  const request = ++loadRequest;
  video.pause(); auditionEnd = null;
  $('editor').disabled = true; $('save').disabled = true; error('');
  $('status').textContent = 'Reading the original audio and drawing its waveform…';
  const context = new AudioContext();
  try {
    const bytes = await file.arrayBuffer();
    const [audio, hash] = await Promise.all([context.decodeAudioData(bytes.slice(0)), crypto.subtle.digest('SHA-256', bytes)]);
    if (request !== loadRequest) return;
    source = {name: file.name, size: file.size, sha256: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join(''), durationMs: Math.floor(audio.duration * 1000), sampleRate: audio.sampleRate};
    peaks = new Float32Array(Math.min(20000, audio.length));
    const samples = audio.getChannelData(0); const stride = Math.ceil(samples.length / peaks.length);
    for (let i = 0; i < peaks.length; i++) {
      for (let j = i * stride; j < Math.min(samples.length, (i + 1) * stride); j++) peaks[i] = Math.max(peaks[i], Math.abs(samples[j]));
    }
    edits = {version: 1, kind: 'demo-audio-edits', source, repairs: [], roomTone: null};
    let restored = false;
    try { const saved = localStorage.getItem(cacheKey()); if (saved) { edits = validateEdits(JSON.parse(saved), source); restored = true; } } catch { /* Ignore corrupt browser drafts. */ }
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    mediaURL = URL.createObjectURL(file); video.src = mediaURL;
    dirty = restored; cancelEdit(); useSelection({startMs: 0, endMs: 0});
    $('start').max = $('end').max = source.durationMs;
    $('source-info').textContent = `${file.name} · ${(source.durationMs / 1000).toFixed(3)} s · microphone waveform`;
    $('zoom').value = '1'; $('zoom-value').textContent = '1×';
    $('editor').disabled = false; $('save').disabled = false;
    $('status').textContent = restored ? 'Restored your local draft for this exact recording. Save JSON to keep a portable copy.' : 'Ready. Drag a range, listen, then add it as a repair or clean background sample.';
    drawWave(); renderMarkers();
  } catch { error('Could not decode this recording. Try the original WebM in Chrome, or a WAV/MP4 copy.'); $('status').textContent = 'Load a supported recording to continue.'; }
  finally { await context.close(); }
}
$('open-media').onchange = event => { void loadMedia(event.target.files[0]); event.target.value = ''; };
$('open-markers').onchange = async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  if (!source || $('editor').disabled) { error('Open the original recording first, then its markers.'); return; }
  try {
    const next = validateEdits(JSON.parse(await file.text()), source);
    if (dirty && !confirm('Replace your current unsaved markers?')) return;
    changed(next); dirty = false; cancelEdit(); $('status').textContent = 'Markers reopened for this original recording.';
  } catch (exception) { error(exception.message); }
};
$('save').onclick = () => attempt(() => {
  const data = validateEdits(edits, source);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `${source.name.replace(/\.[^.]+$/, '')}.audio-edits.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000); dirty = false;
  $('status').textContent = 'Markers exported. Keep the JSON with your original recording.';
});
$('start').oninput = $('end').oninput = () => useSelection({startMs: Number($('start').value), endMs: Number($('end').value)});
$('mark-start').onclick = () => useSelection({...selection, startMs: clockMs()});
$('mark-end').onclick = () => useSelection({...selection, endMs: clockMs()});
$('audition').onclick = () => attempt(() => void audition(readSelection()));
$('add').onclick = () => attempt(() => {
  const range = readSelection();
  const repairs = edits.repairs.filter((_, i) => typeof editing !== 'number' || i !== editing);
  changed({...edits, repairs: [...repairs, range]}); cancelEdit();
});
$('background').onclick = () => attempt(() => { changed({...edits, roomTone: readSelection()}); cancelEdit(); });
$('cancel-edit').onclick = cancelEdit;
$('zoom').oninput = () => { $('zoom-value').textContent = `${$('zoom').value}×`; drawWave(); showPlayhead(); };
$('gain').oninput = drawWave; $('follow').onclick = showPlayhead;
$('wave-scroll').onscroll = updateRuler;
let dragStart;
const pointerTime = event => Math.max(0, Math.min(source.durationMs, Math.round((event.clientX - $('wave-stage').getBoundingClientRect().left) / $('wave-stage').clientWidth * source.durationMs)));
$('wave').onpointerdown = event => {
  if (!source || $('editor').disabled) return;
  auditionEnd = null; video.pause(); dragStart = pointerTime(event); video.currentTime = dragStart / 1000;
  useSelection({startMs: dragStart, endMs: dragStart}); $('wave').setPointerCapture(event.pointerId);
};
$('wave').onpointermove = event => {
  if (dragStart === undefined) return;
  const time = pointerTime(event); useSelection({startMs: Math.min(dragStart, time), endMs: Math.max(dragStart, time)});
};
$('wave').onpointerup = $('wave').onpointercancel = () => { dragStart = undefined; };
video.addEventListener('pause', () => { auditionEnd = null; });
function tick() {
  if (source) {
    const ms = clockMs(); $('clock').textContent = `${ms} / ${source.durationMs} ms`;
    $('playhead').style.left = `${ms / source.durationMs * 100}%`;
    if (auditionEnd !== null && ms >= auditionEnd) {
      if ($('loop').checked && !video.ended) video.currentTime = selection.startMs / 1000;
      else { video.pause(); auditionEnd = null; }
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
new ResizeObserver(drawWave).observe($('wave-scroll'));
document.addEventListener('keydown', event => {
  if (!source || $('editor').disabled || event.repeat || /^(INPUT|SELECT|TEXTAREA|VIDEO|A)$/.test(event.target.tagName)) return;
  if (event.code === 'Space' && event.target.tagName === 'BUTTON') return;
  const actions = {KeyI: () => $('mark-start').click(), KeyO: () => $('mark-end').click(), KeyP: () => $('audition').click(), Space: () => { auditionEnd = null; if (video.paused) void video.play().catch(() => error('Click the video Play button to start.')); else video.pause(); }};
  if (actions[event.code]) { event.preventDefault(); actions[event.code](); }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
