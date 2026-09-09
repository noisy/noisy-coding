// Browser APIs are replaced at their boundary; no camera, microphone or STT I/O.
import test from 'node:test';
import assert from 'node:assert/strict';

for (const scenario of [
  { id: 'crew', users: ['u1', 'u2', 'u3'], clips: ['lux-1', 'lux-2', 'rex-1', 'luna-1', 'luna-2'] },
  { id: 'hero', users: ['u1', 'u2'], clips: ['hero-lux-1', 'hero-lux-2', 'hero-lux-3', 'hero-lux-4'] },
]) test(`${scenario.id}: continuous recording preserves every user turn and reply`, async () => {
  const elements = new Map();
  const element = () => ({
    textContent: '', value: '', disabled: false, currentTime: 0, paused: true,
    children: [], append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute() {}, addEventListener() {}, blur() {}, click() {},
    play() { return Promise.resolve(); },
    pause() {},
  });
  globalThis.document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element, createTextNode: text => text, addEventListener() {},
  };
  globalThis.window = { addEventListener() {} };
  const realSetTimeout = globalThis.setTimeout;
  const realSetInterval = globalThis.setInterval;
  globalThis.setTimeout = (fn, ms) => ms <= 3000 ? realSetTimeout(fn, 0) : realSetTimeout(fn, ms);
  globalThis.setInterval = () => 0;
  const tracks = [{ kind: 'audio', stop() {} }, { kind: 'video', stop() {} }];
  const stream = { getTracks: () => tracks };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    mediaDevices: { getUserMedia: async () => stream },
  } });
  const recordings = [];
  class FakeRecorder {
    static isTypeSupported() { return true; }
    constructor(input) { this.input = input; this.state = 'inactive'; this.mimeType = 'video/webm'; recordings.push(this); }
    start() { this.state = 'recording'; queueMicrotask(() => this.onstart()); }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['test video']) }); queueMicrotask(() => this.onstop()); }
  }
  globalThis.MediaRecorder = window.MediaRecorder = FakeRecorder;
  globalThis.AudioContext = class {
    sampleRate = 48000;
    audioWorklet = { addModule: async () => {} };
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  };
  globalThis.AudioWorkletNode = window.AudioWorkletNode = class {
    port = {}; connect() {} disconnect() {}
  };
  globalThis.fetch = async () => ({ json: async () => ({ websocketPort: 8791 }) });
  globalThis.WebSocket = class {
    static OPEN = 1;
    readyState = 1;
    constructor() { queueMicrotask(() => this.onopen()); }
    send(data) {
      const command = JSON.parse(data);
      if (command.type === 'start') {
        this.utterance = command.utterance;
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ type: 'ready' }) }));
      } else if (command.type === 'finish') {
        const utterance = this.utterance;
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ type: 'transcript', utterance, text: `final ${utterance}`, final: true }) }));
      }
    }
    close() { this.readyState = 3; this.onclose?.(); }
  };
  globalThis.Audio = class {
    paused = true;
    play() {
      this.paused = false;
      this.onplaying?.();
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    }
    pause() { this.paused = true; this.onpause?.(); }
  };
  const blobs = [];
  const createURL = URL.createObjectURL;
  URL.createObjectURL = blob => { blobs.push(blob); return 'blob:test'; };
  try {
    await import(`./recorder.mjs?scenario=${scenario.id}`);
    const get = id => document.getElementById(id);
    get('scenario').value = scenario.id;
    get('scenario').onchange();
    await get('record').onclick();
    for (const user of scenario.users) {
      for (let attempt = 0; get('next').disabled && attempt < 100; attempt++) {
        await new Promise(resolve => realSetTimeout(resolve, 1));
      }
      assert.equal(get('next').disabled, false);
      await get('next').onclick();
    }
    await new Promise(resolve => realSetTimeout(resolve, 0));
    get('save-timing').onclick();
    const saved = JSON.parse(await blobs.at(-1).text());

    assert.equal(saved.scenario.id, scenario.id);
    if (scenario.id === 'hero') {
      const firstUser = saved.events.findIndex(e => e.type === 'user-start');
      assert.equal(saved.events.slice(0, firstUser).filter(e => e.type === 'agent-end').length, 2);
    }
    assert.equal(recordings.length, 1);
    assert.equal(recordings[0].input, stream);
    assert.deepEqual(saved.events.filter(e => e.type === 'user-start').map(e => e.utterance), scenario.users);
    assert.deepEqual(saved.events.filter(e => e.type === 'agent-start').map(e => e.clip), scenario.clips);
    assert.deepEqual(saved.events.filter(e => e.type === 'transcript').map(e => e.utterance), scenario.users);
    assert.equal(get('state').textContent, 'Review');
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.setInterval = realSetInterval;
    URL.createObjectURL = createURL;
  }
});
