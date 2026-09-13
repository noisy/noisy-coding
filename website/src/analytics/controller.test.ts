import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebsiteAnalytics, PREFERENCE_KEY } from './controller.ts';

function setup({ production = true, projectToken = 'test-project', saved = null as string | null } = {}) {
  const calls: unknown[][] = [];
  let config: any;
  const storage = new Map<string, string>();
  if (saved) storage.set(PREFERENCE_KEY, saved);
  const client = {
    init: (_token: string, options: any) => { config = options; calls.push(['init']); },
    capture: (event: string, properties: any) => { calls.push(['capture', event, properties]); },
    opt_in_capturing: () => { calls.push(['opt-in']); },
    opt_out_capturing: () => { calls.push(['opt-out']); },
    reset: () => { calls.push(['reset']); },
  };
  const analytics = createWebsiteAnalytics(client as any, {
    production, projectToken, host: 'https://example.test',
    origin: 'https://noisy.example', pathname: '/',
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } },
  });
  return { analytics, calls, storage, config: () => config };
}

test('initial visits and rejected analytics never initialize the SDK', () => {
  const { analytics, calls } = setup();
  analytics.start();
  analytics.trackGuide('codex');
  analytics.setEnabled(false);
  analytics.trackGuide('claude_code');
  assert.deepEqual(calls, []);
});

test('accepting analytics records a pageview and guide click, and persists the choice', () => {
  const { analytics, calls, storage } = setup();
  analytics.setEnabled(true);
  analytics.trackGuide('codex');
  assert.deepEqual({ calls, preference: storage.get(PREFERENCE_KEY) }, {
    calls: [['init'], ['opt-in'], ['capture', '$pageview', { surface: 'website' }], ['capture', 'installation_guide_opened', { guide: 'codex', surface: 'website' }]],
    preference: 'enabled',
  });
});

test('withdrawing analytics stops further captures and clears identity through the SDK', () => {
  const { analytics, calls } = setup({ saved: 'enabled' });
  analytics.start(); calls.length = 0;
  analytics.setEnabled(false);
  analytics.trackGuide('codex');
  assert.deepEqual(calls, [['reset'], ['opt-out']]);
});

for (const options of [{ production: false }, { projectToken: '' }]) {
  test(`unconfigured or development builds stay silent: ${JSON.stringify(options)}`, () => {
    const { analytics, calls } = setup({ ...options, saved: 'enabled' });
    analytics.start(); analytics.trackGuide('codex');
    assert.deepEqual(calls, []);
  });
}

test('outbound events exclude query strings, transcripts and automatic browser properties', () => {
  const { analytics, config } = setup();
  analytics.setEnabled(true);
  const result = config().before_send({ event: '$pageview', properties: {
    distinct_id: 'visitor-1', surface: 'website', '$current_url': 'https://noisy.example/?token=private',
    '$referrer': 'https://example.test/private', transcript: 'private conversation', email: 'private@example.test',
  } });
  assert.deepEqual(result, { event: '$pageview', properties: {
    distinct_id: 'visitor-1', surface: 'website', '$current_url': 'https://noisy.example/', '$pathname': '/', '$geoip_disable': true,
  } });
  assert.equal(config().before_send({ event: '$autocapture', properties: {} }), null);
});
