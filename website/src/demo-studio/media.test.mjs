import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureTake, playClip } from './media.mjs';

test('reference recording requests only microphone and keeps all original chunks', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = globalThis.window;
  const originalRecorder = globalThis.MediaRecorder;
  let requested, stopped = 0, started = 0;
  const track = { stop() { stopped++; } };
  const stream = { getTracks: () => [track] };
  class Recorder {
    mimeType = 'audio/webm'; state = 'inactive';
    start() { this.state = 'recording'; queueMicrotask(() => this.onstart()); }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['original audio']) }); this.onstop(); }
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async options => { requested = options; return stream; } } } });
  globalThis.window = { MediaRecorder: Recorder }; globalThis.MediaRecorder = Recorder;
  try {
    const take = await captureTake(false, () => started++, () => assert.fail('Unexpected recording failure'));
    const blob = await take.stop();
    assert.deepEqual({ requested, stopped, started, content: await blob.text() }, { requested: { video: false, audio: true }, stopped: 1, started: 1, content: 'original audio' });
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
    globalThis.window = originalWindow; globalThis.MediaRecorder = originalRecorder;
  }
});
test('cancelled playback stops audio and settles the pending turn', async () => {
  const originalAudio = globalThis.Audio;
  let paused = false;
  globalThis.Audio = class { play() { return Promise.resolve(); } pause() { paused = true; } };
  try {
    const controller = new AbortController();
    const playing = playClip('voice.mp3', controller.signal, () => {});
    controller.abort();
    await playing;
    assert.equal(paused, true);
  } finally { globalThis.Audio = originalAudio; }
});
