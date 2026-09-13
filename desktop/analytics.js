const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PostHog } = require('posthog-node');

const EVENTS = new Set(['app_started', 'analytics_enabled', 'daemon_ready', 'daemon_unavailable', 'dashboard_opened', 'widget_shown', 'widget_hidden', 'click_through_enabled', 'click_through_disabled']);
const SHUTDOWN_TIMEOUT_MS = 2000;

function loadAnalyticsConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'analytics-config.json'), 'utf8')); }
  catch { return {}; }
}

function createDesktopAnalytics({ config, dataPath, mode, isPackaged, version, platform }, Client = PostHog) {
  const available = isPackaged && mode === 'production' && Boolean(config.projectToken);
  const preferencePath = path.join(dataPath, 'usage-analytics.json');
  let state = { enabled: false, distinctId: null };
  if (available) {
    try {
      const stored = JSON.parse(fs.readFileSync(preferencePath, 'utf8'));
      if (stored.enabled === true && typeof stored.distinctId === 'string') state = stored;
    } catch { /* New installs and unreadable preferences default to no collection. */ }
  }
  let client;
  function getClient() {
    if (!client) {
      client = new Client(config.projectToken, {
        host: config.host,
        disableGeoip: true,
        enableExceptionAutocapture: false,
        enableLocalEvaluation: false,
        requestTimeout: SHUTDOWN_TIMEOUT_MS,
        fetchRetryCount: 0,
      });
      client.on('error', () => {});
    }
    return client;
  }
  function track(event) {
    if (!available || !state.enabled || !EVENTS.has(event)) return;
    try {
      // Immediate delivery avoids retaining a batch after analytics is disabled.
      void getClient().captureImmediate({
        distinctId: state.distinctId,
        event,
        disableGeoip: true,
        properties: { surface: 'desktop', app_version: version, platform, $process_person_profile: false },
      }).catch(() => {});
    } catch { /* Analytics never interrupts app startup or a window action. */ }
  }
  return {
    available,
    get enabled() { return available && state.enabled; },
    track,
    setEnabled(enabled) {
      if (!available || enabled === state.enabled) return;
      const next = { enabled, distinctId: enabled ? randomUUID() : null };
      // An unwritable setting must never prevent a user from opting out.
      if (!enabled) state = next;
      try {
        fs.mkdirSync(dataPath, { recursive: true });
        fs.writeFileSync(preferencePath, JSON.stringify(next), { mode: 0o600 });
        state = next;
      } catch { return; }
      if (enabled) track('analytics_enabled');
    },
    async shutdown() {
      if (!client) return;
      try { await client.shutdown(SHUTDOWN_TIMEOUT_MS); } catch { /* Best effort before exit. */ }
    },
  };
}

module.exports = { createDesktopAnalytics, loadAnalyticsConfig };
