const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDesktopAnalytics } = require('./analytics');

function setup(t, overrides = {}) {
  const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'noisy-analytics-test-'));
  t.after(() => fs.rmSync(dataPath, { recursive: true, force: true }));
  const events = [];
  const shutdowns = [];
  let clients = 0;
  class Client {
    constructor() { clients++; }
    on() {}
    async captureImmediate(event) { events.push(event); }
    async shutdown(timeout) { shutdowns.push(timeout); }
  }
  const options = { config: { projectToken: 'test-project', host: 'https://example.test' }, dataPath, mode: 'production', isPackaged: true, version: '1.2.3', platform: 'darwin', ...overrides };
  return { create: () => createDesktopAnalytics(options, Client), events, shutdowns, clientCount: () => clients };
}

test('a new installation sends nothing and does not initialize PostHog', t => {
  const fixture = setup(t);
  fixture.create().track('app_started');
  assert.deepEqual({ events: fixture.events, clients: fixture.clientCount() }, { events: [], clients: 0 });
});

test('consenting installs retain a random identity across launches and only send the event contract', t => {
  const fixture = setup(t);
  fixture.create().setEnabled(true);
  const relaunched = fixture.create();
  relaunched.track('app_started');
  relaunched.track('private transcript');
  const id = fixture.events[0].distinctId;
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(fixture.events, ['analytics_enabled', 'app_started'].map(event => ({
    distinctId: id, event, disableGeoip: true,
    properties: { surface: 'desktop', app_version: '1.2.3', platform: 'darwin', $process_person_profile: false },
  })));
});

test('opting out remains effective after relaunch and opting in creates a fresh identity', t => {
  const fixture = setup(t);
  const analytics = fixture.create();
  analytics.setEnabled(true);
  const oldId = fixture.events[0].distinctId;
  analytics.setEnabled(false);
  analytics.track('dashboard_opened');
  const relaunched = fixture.create();
  relaunched.track('app_started');
  assert.equal(fixture.events.length, 1);
  relaunched.setEnabled(true);
  assert.notEqual(fixture.events[1].distinctId, oldId);
});

for (const overrides of [{ mode: 'local' }, { isPackaged: false }, { config: {} }]) {
  test(`development and unconfigured builds cannot enable collection: ${JSON.stringify(overrides)}`, t => {
    const fixture = setup(t, overrides);
    const analytics = fixture.create();
    analytics.setEnabled(true); analytics.track('app_started');
    assert.deepEqual({ enabled: analytics.enabled, events: fixture.events, clients: fixture.clientCount() }, { enabled: false, events: [], clients: 0 });
  });
}

test('shutdown asks the SDK to finish within two seconds', async t => {
  const fixture = setup(t);
  const analytics = fixture.create();
  analytics.setEnabled(true);
  await analytics.shutdown();
  assert.deepEqual(fixture.shutdowns, [2000]);
});
