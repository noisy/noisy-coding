import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { agentPlacements, encodeWave, bundleTake } from './artifacts.mjs';

test('agent track preserves pauses and clips an interrupted reply at the take end', () => {
  const events = [
    { type: 'agent-start', clip: 'c1', atMs: 2000 }, { type: 'agent-end', clip: 'c1', atMs: 4000 },
    { type: 'agent-start', clip: 'c2', atMs: 7000 },
  ];
  assert.deepEqual(agentPlacements(events, 8000), [
    { clip: 'c1', startMs: 2000, durationMs: 2000 }, { clip: 'c2', startMs: 7000, durationMs: 1000 },
  ]);
});
test('WAV output declares stereo PCM and interleaves channels without exceeding its range', () => {
  const wave = encodeWave({ numberOfChannels: 2, length: 2, sampleRate: 48000, getChannelData: index => index ? [1, -2] : [0, -1] });
  const view = new DataView(wave.buffer);
  assert.deepEqual([strFromU8(wave.slice(0, 4)), view.getUint16(22, true), view.getUint32(24, true), view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true), view.getInt16(50, true)], ['RIFF', 2, 48000, 0, 32767, -32768, -32768]);
});
test('ZIP keeps the actor original byte-for-byte alongside timing, aligned agents and source clips', async () => {
  const take = { name: 'take-1', events: [{ type: 'recording-stop', atMs: 2000 }] };
  const archive = await bundleTake(new Blob(['original'], { type: 'video/webm' }), take, { audio: new Blob(['wave']), sources: { 'clips/lux.mp3': new Uint8Array([1, 2]) } });
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  assert.deepEqual({ original: strFromU8(files['take-1.webm']), take: JSON.parse(strFromU8(files['take-1.json'])), agents: strFromU8(files['agents-aligned.wav']), clip: [...files['clips/lux.mp3']] }, { original: 'original', take, agents: 'wave', clip: [1, 2] });
  assert.ok(files['README.txt']);
});
