import { zip, strToU8 } from 'fflate';

export function agentPlacements(events, durationMs) {
  return events.filter(event => event.type === 'agent-start').map(event => {
    const end = events.find(end => end.type === 'agent-end' && end.clip === event.clip && end.atMs >= event.atMs);
    return { clip: event.clip, startMs: event.atMs, durationMs: Math.max(0, Math.min(durationMs, end?.atMs ?? durationMs) - event.atMs) };
  });
}

/** PCM WAV keeps the aligned track portable, without another lossy encode. */
export function encodeWave(buffer) {
  const channels = buffer.numberOfChannels;
  const dataLength = buffer.length * channels * 2;
  const bytes = new ArrayBuffer(44 + dataLength);
  const view = new DataView(bytes);
  const tag = (offset, text) => [...text].forEach((character, i) => view.setUint8(offset + i, character.charCodeAt(0)));
  tag(0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, dataLength, true);
  const samples = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < buffer.length; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.max(-1, Math.min(1, samples[channel][frame]));
      view.setInt16(44 + (frame * channels + channel) * 2, value * (value < 0 ? 32768 : 32767), true);
    }
  }
  return new Uint8Array(bytes);
}

export async function renderAgents(events, durationMs, clips) {
  const placements = agentPlacements(events, durationMs);
  const sampleRate = 48000;
  const context = new OfflineAudioContext(2, Math.max(1, Math.ceil(durationMs / 1000 * sampleRate)), sampleRate);
  const sources = {};
  const decoded = new Map();
  for (const clip of new Set(placements.map(placement => placement.clip))) {
    if (!clips[clip]) throw new Error(`Missing voice clip: ${clip}`);
    const response = await fetch(clips[clip]);
    if (!response.ok) throw new Error('A voice clip could not be loaded. Your original recording is still available.');
    const bytes = await response.arrayBuffer();
    sources[`clips/${clip}.mp3`] = new Uint8Array(bytes);
    decoded.set(clip, await context.decodeAudioData(bytes.slice(0)));
  }
  for (const placement of placements) {
    if (placement.durationMs <= 0) continue;
    const source = context.createBufferSource();
    source.buffer = decoded.get(placement.clip);
    source.connect(context.destination);
    source.start(placement.startMs / 1000, 0, Math.min(placement.durationMs / 1000, source.buffer.duration));
  }
  const buffer = await context.startRendering();
  return { audio: new Blob([encodeWave(buffer)], { type: 'audio/wav' }), sources };
}

export async function bundleTake(recording, take, agents) {
  const extension = recording.type.includes('mp4') ? 'mp4' : 'webm';
  const files = {
    [`${take.name}.${extension}`]: new Uint8Array(await recording.arrayBuffer()),
    [`${take.name}.json`]: strToU8(JSON.stringify(take, null, 2)),
    'agents-aligned.wav': new Uint8Array(await agents.audio.arrayBuffer()),
    ...agents.sources,
    'README.txt': strToU8('Demo Studio take\n\nThe named media file is the untouched browser recording: actor microphone only, plus video when selected.\nThe matching JSON contains the scenario and actual event timestamps in milliseconds. Transcript text is scripted, not speech recognition.\nagents-aligned.wav contains only agent speech, positioned at its recorded times with silence between replies. Put this and the original recording at time zero in your editor.\nclips/ contains the original MP3 sources.\nIf using an external camera, also send its original recording. Align its audio with the browser microphone reference before editing.\nKeep these originals. No files were uploaded by Demo Studio.\n'),
  };
  return new Promise((resolve, reject) => zip(files, { level: 0 }, (error, data) => error ? reject(error) : resolve(new Blob([data], { type: 'application/zip' }))));
}
