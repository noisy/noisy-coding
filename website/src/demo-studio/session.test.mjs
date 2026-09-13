import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StudioSession } from './session.mjs';

const scenario = { id: 'example', intro: [], turns: [
  { agent: 'Lux', prompt: 'Check this.', replies: [{ voice: 'Lux', text: 'Done.', clip: 'clip1' }] },
  { agent: 'Lux', prompt: 'Thanks.', replies: [] },
] };
function setup(overrides = {}) {
  let time = 0;
  return new StudioSession(scenario, { now: () => time, update() {},
    wait: async ms => { time += ms; }, play: async (_reply, _signal, started) => { started(); time += 500; }, ...overrides });
}
test('records actual reply playback and advances only once for repeated Space presses', async () => {
  const session = setup();
  await session.start();
  await Promise.all([session.advance(), session.advance()]);
  assert.deepEqual(session.events.filter(e => ['agent-start','agent-end','user-start'].includes(e.type)).map(e => [e.type, e.atMs, e.utterance ?? e.clip]), [
    ['user-start', 0, 'u1'], ['agent-start', 1200, 'clip1'], ['agent-end', 1700, 'clip1'], ['user-start', 1700, 'u2'],
  ]);
  await session.advance();
  assert.equal(session.events.at(-1).complete, true);
});
test('stopping during activity prevents late audio and further prompts', async () => {
  let release;
  const session = setup({ wait: () => new Promise(resolve => { release = resolve; }), play: () => assert.fail('Playback must not start') });
  await session.start();
  const pending = session.advance();
  session.stop();
  release();
  await pending;
  assert.equal(session.events.at(-1).type, 'recording-stop');
  assert.equal(session.events.filter(e => e.type === 'user-start').length, 1);
});

test('hero production pause is exported between replies and every line stays ordered', async () => {
  const { SCENARIOS } = await import('../../../tools/demo-recorder/scenarios.mjs');
  let time = 0;
  const session = new StudioSession(SCENARIOS.find(s => s.id === 'hero-search'), {
    now: () => time, update() {}, wait: async ms => { time += ms; },
    play: async (_reply, _signal, started) => { started(); time += 100; },
  });
  await session.start();
  while (session.phase === 'user') await session.advance();
  const events = session.events;
  const deploying = events.find(e => e.text === 'Deploying to production');
  const onIt = events.find(e => e.type === 'agent-end' && e.clip === 'hero-lux-search-4');
  const live = events.find(e => e.type === 'agent-start' && e.clip === 'hero-lux-search-production');
  assert.deepEqual([deploying.atMs, live.atMs], [onIt.atMs, onIt.atMs + 2200]);
  assert.deepEqual(events.filter(e => e.type === 'user-start').map(e => e.utterance), ['u1','u2','u3','u4','u5']);
});
