import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationEvents, transcriptsAt, activeClipAt } from './timeline.mjs';

const events = [
  { sequence: 0, type: 'user-start', utterance: 'u1', atMs: 500 },
  { sequence: 1, type: 'transcript', utterance: 'u1', text: 'how', atMs: 1000 },
  { sequence: 2, type: 'user-end', utterance: 'u1', atMs: 1400 },
  { sequence: 3, type: 'agent-start', clip: 'lux-1', atMs: 1500 },
  { sequence: 4, type: 'transcript', utterance: 'u1', text: 'how is staging?', final: true, atMs: 1700 },
  { sequence: 5, type: 'agent-end', clip: 'lux-1', atMs: 4000 },
  { sequence: 6, type: 'user-start', utterance: 'u2', atMs: 4100 },
];

test('advancing transcripts never changes raw events or any other event timing', () => {
  const original = structuredClone(events);
  const adjusted = presentationEvents(events, { u1: -800 });
  assert.deepEqual(events, original);
  assert.deepEqual(adjusted.filter(e => e.type === 'transcript').map(e => e.displayAtMs), [500, 900]);
  assert.deepEqual(adjusted.filter(e => e.type !== 'transcript').map(e => [e.atMs, e.displayAtMs]),
    [[500, 500], [1400, 1400], [1500, 1500], [4000, 4000], [4100, 4100]]);
});

test('a late final revision stays attached to its original turn', () => {
  assert.deepEqual(transcriptsAt(events, 4200, { u1: 2500 }), [
    { utterance: 'u1', text: 'how is staging?' },
  ]);
});

test('seeking finds agent audio from its recorded playback interval', () => {
  assert.deepEqual([activeClipAt(events, 1499), activeClipAt(events, 2300)?.clip, activeClipAt(events, 4000)],
    [null, 'lux-1', null]);
});
