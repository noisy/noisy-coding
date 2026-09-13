import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebsiteAnalytics, PREFERENCE_KEY, EXCLUSION_KEY } from './controller.ts';

function setup({ production = true, projectToken = 'test-project', saved = null as string | null, excludeThisBrowser = false } = {}) {
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
    production, projectToken, excludeThisBrowser, host: 'https://example.test',
    origin: 'https://noisy.example', pathname: '/',
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } },
  });
  return { analytics, calls, storage, config: () => config };
}

test('a saved opt-out prevents initialization and capture', () => {
  const { analytics, calls } = setup({ saved: 'disabled' });
  analytics.start();
  analytics.trackGuide('codex');
  analytics.setEnabled(false);
  analytics.trackGuide('claude_code');
  assert.deepEqual(calls, []);
});

test('re-enabling analytics records a pageview and guide click, and persists the choice', () => {
  const { analytics, calls, storage } = setup({ saved: 'disabled' });
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

test('browser exclusion persists and overrides attempts to enable analytics', () => {
  const { analytics, calls, storage } = setup();
  analytics.setExcluded(true);
  analytics.setEnabled(true);
  analytics.trackGuide('codex');
  assert.deepEqual({ calls, excluded: analytics.excluded, saved: storage.get(EXCLUSION_KEY) }, { calls: [], excluded: true, saved: 'true' });
});

test('an exclusion link overrides saved consent before the SDK initializes', () => {
  const { analytics, calls } = setup({ saved: 'enabled', excludeThisBrowser: true });
  analytics.start();
  assert.deepEqual(calls, []);
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
  analytics.start();
  const result = config().before_send({ event: '$pageview', properties: {
    token: 'test-project', distinct_id: 'visitor-1', surface: 'website', '$current_url': 'https://noisy.example/?token=private',
    '$referrer': 'https://example.test/private', transcript: 'private conversation', email: 'private@example.test',
  } });
  assert.deepEqual(result, { event: '$pageview', properties: {
    token: 'test-project', distinct_id: 'visitor-1', surface: 'website', '$current_url': 'https://noisy.example/', '$pathname': '/', '$geoip_disable': true,
  } });
  assert.equal(config().before_send({ event: '$autocapture', properties: {} }), null);
});

test('engagement events respect opt-out and preserve only declared dimensions', () => {
  const { analytics, calls, config } = setup({ saved: 'disabled' });
  const engage = () => {
    analytics.trackScroll(); analytics.trackDepth(50);
    analytics.trackDemo('hero', 'unmute'); analytics.trackGetStarted('header');
    analytics.trackDownload('mac', 'install');
  };
  engage();
  assert.deepEqual(calls, []);
  analytics.setEnabled(true); calls.length = 0; engage();
  assert.deepEqual(calls.map(call => call.slice(1)), [
    ['page_scrolled', { surface: 'website' }],
    ['scroll_depth_reached', { depth_percent: 50, surface: 'website' }],
    ['video_demo_interacted', { demo: 'hero', action: 'unmute', surface: 'website' }],
    ['get_started_clicked', { placement: 'header', surface: 'website' }],
    ['download_clicked', { platform: 'mac', placement: 'install', surface: 'website' }],
  ]);
  const outgoing = config().before_send({ event: 'video_demo_interacted', properties: { demo: 'crew', action: 'play', transcript: 'private' } });
  assert.deepEqual(outgoing.properties, { demo: 'crew', action: 'play', '$current_url': 'https://noisy.example/', '$pathname': '/', '$geoip_disable': true });
  analytics.setExcluded(true); calls.length = 0; engage();
  assert.deepEqual(calls, []);
});


test('a new visitor records a pageview without clicking an analytics control', () => {
  const { analytics, calls, storage } = setup();
  analytics.start();
  assert.deepEqual({ calls, enabled: analytics.enabled, saved: storage.get(PREFERENCE_KEY) }, {
    calls: [['init'], ['opt-in'], ['capture', '$pageview', { surface: 'website' }]],
    enabled: true, saved: undefined,
  });
});

test('browser exclusion overrides automatic tracking for a new visitor', () => {
  const { analytics, calls } = setup({ excludeThisBrowser: true });
  analytics.start();
  assert.deepEqual({ calls, enabled: analytics.enabled }, { calls: [], enabled: false });
});
