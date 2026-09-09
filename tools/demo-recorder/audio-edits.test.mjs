import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEdits, validateRange } from './audio-edits.mjs';
const source = { name: 'take.webm', sha256: 'source1', size: 100, durationMs: 10000 };
const document = { kind: 'demo-audio-edits', version: 1, source, repairs: [{startMs: 4000, endMs: 4200}, {startMs: 1000, endMs: 1100}], roomTone: {startMs: 8000, endMs: 9000} };
test('sorts independent repair intervals without altering the source or original document', () => {
  const snapshot = structuredClone(document);
  assert.deepEqual(validateEdits(document, source), {...document, repairs: [...document.repairs].reverse()});
  assert.deepEqual(document, snapshot);
});
test('rejects reversed, fractional, nonfinite and out-of-bounds boundaries', () => {
  for (const range of [{startMs: 200, endMs: 100}, {startMs: -1, endMs: 100}, {startMs: 1.5, endMs: 100}, {startMs: 0, endMs: Infinity}, {startMs: 9000, endMs: 10001}]) {
    assert.throws(() => validateRange(range, source.durationMs));
  }
});
test('rejects another take, overlapping repairs and noisy reference samples but permits adjacent intervals', () => {
  assert.throws(() => validateEdits(document, {...source, sha256: 'source2'}), /different original/);
  assert.throws(() => validateEdits({...document, repairs: [{startMs: 100, endMs: 300}, {startMs: 200, endMs: 400}]}, source), /overlap/);
  assert.throws(() => validateEdits({...document, roomTone: {startMs: 1000, endMs: 1500}}, source), /background sample/);
  assert.equal(validateEdits({...document, repairs: [{startMs: 0, endMs: 100}, {startMs: 100, endMs: 200}]}, source).repairs.length, 2);
});
