import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companionAt } from './preview.mjs';
const scenario = { turns: [{ agent: 'Lux', replies: [{ voice: 'Lux' }] }] };
const events = [
  { sequence: 0, type: 'user-start', voice: 'Lux', prompt: 'Please check.', atMs: 0 },
  { sequence: 1, type: 'user-end', atMs: 1000 },
  { sequence: 2, type: 'activity-start', text: 'Running tests', atMs: 1000 },
  { sequence: 3, type: 'activity-end', atMs: 3000 },
  { sequence: 4, type: 'agent-start', voice: 'Lux', text: 'Tests passed.', atMs: 3000 },
  { sequence: 5, type: 'agent-end', atMs: 4000 },
];
test('seeking reconstructs the widget rather than leaving future messages visible', () => {
  assert.equal(companionAt(events, scenario, 3500).mode, 'claude');
  const earlier = companionAt(events, scenario, 1500);
  assert.deepEqual({ mode: earlier.mode, activity: earlier.activity, text: earlier.feed.map(message => message.text) }, { mode: 'idle', activity: 'Running tests', text: ['Please check.'] });
  assert.equal(companionAt(events, scenario, 500).liveText, 'Please check.');
});
