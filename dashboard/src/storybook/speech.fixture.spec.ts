import { effectScope, type EffectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechFixture } from './speech.fixture';

const tests = { engine: 'Demo speech', tests: [{ file: 'sample.wav', seconds: 2, expected: 'Hello' }] };
let scope: EffectScope;
let originalFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalFetch = vi.fn().mockResolvedValue(Response.json({ realRequest: true }));
  vi.stubGlobal('fetch', originalFetch);
  scope = effectScope();
  scope.run(() => useSpeechFixture(tests, 0, body => ({ ...body, ok: true })));
});
afterEach(() => {
  scope.stop();
  vi.unstubAllGlobals();
});

describe('status-board story isolation', () => {
  it('provides the speech list without contacting the daemon', async () => {
    const result = await window.fetch('/tests/speech').then(response => response.json());
    expect({ result, requests: originalFetch.mock.calls }).toEqual({ result: tests, requests: [] });
  });

  it('returns a simulated run for the requested recording and pipeline', async () => {
    const result = await window.fetch('/tests/speech/run', {
      method: 'POST', body: JSON.stringify({ file: 'sample.wav', path: 'live' }),
    }).then(response => response.json());
    expect(result).toEqual({ file: 'sample.wav', path: 'live', ok: true });
  });

  it.each(['/index.json', 'https://example.test/tests/speech', '/tests/speech/unrelated'])(
    'leaves unrelated requests unchanged: %s', async url => {
      await window.fetch(url);
      expect(originalFetch).toHaveBeenCalledWith(url, undefined);
    },
  );

  it('restores fetch when navigation disposes the story', () => {
    scope.stop();
    expect(window.fetch).toBe(originalFetch);
  });
});
