import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StudioSession } from './session.mjs';

const scenario = { id: 'example', intro: [], turns: [
  { agent: 'Lux', prompt: 'Check this.', replies: [{ voice: 'Lux', text: 'Done.', clip: 'clip1' }] },
  { agent: 'Lux', prompt: 'Thanks.', replies: [] },
] };
function setup(overrides = {}) {
  let time = 0;
  return new StudioSession(scenario, { schedule: { beforeTurn: {}, beforeReply: { clip1: [{ durationMs: 1200, text: 'Thinking…' }] } }, now: () => time, update() {},
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

test('replays quiet gaps and work after replies before prompting the actor', async () => {
  const session = setup({ schedule: { beforeReply: {}, beforeTurn: { u2: [
    { durationMs: 200, text: null }, { durationMs: 3300, text: 'Editing file' }, { durationMs: 100, text: null },
  ] } } });
  await session.start();
  await session.advance();
  assert.deepEqual(session.events.filter(e => ['activity-start', 'activity-end', 'user-start'].includes(e.type)).map(e => [e.type, e.atMs]), [
    ['user-start', 0], ['activity-start', 700], ['activity-end', 4000], ['user-start', 4100],
  ]);
});
