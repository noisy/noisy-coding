import type { PostHog, PostHogConfig } from 'posthog-js';

export const PREFERENCE_KEY = 'noisy-usage-analytics';
type Client = Pick<PostHog, 'init' | 'capture' | 'opt_in_capturing' | 'opt_out_capturing' | 'reset'>;
type Preference = 'enabled' | 'disabled' | null;

export function createWebsiteAnalytics(client: Client, options: {
  projectToken: string;
  host: string;
  production: boolean;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  origin: string;
  pathname: string;
}) {
  const available = options.production && Boolean(options.projectToken);
  let preference: Preference = null;
  try {
    const stored = options.storage.getItem(PREFERENCE_KEY);
    if (stored === 'enabled' || stored === 'disabled') preference = stored;
  } catch { /* Storage can be blocked; the current visit can still opt in. */ }
  let initialized = false;

  function capture(event: '$pageview' | 'installation_guide_opened', properties: Record<string, string> = {}) {
    if (!available || preference !== 'enabled' || !initialized) return;
    try { client.capture(event, { ...properties, surface: 'website' }); } catch { /* Analytics must not interrupt navigation. */ }
  }

  function start() {
    if (!available || preference !== 'enabled') return;
    if (!initialized) {
      const config: Partial<PostHogConfig> = {
        api_host: options.host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_heatmaps: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        person_profiles: 'never',
        persistence: 'localStorage',
        // Do not retain automatic URL, referrer, campaign or browser properties.
        before_send: (event) => {
          if (!event || !['$pageview', 'installation_guide_opened'].includes(event.event)) return null;
          const allowed = ['distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version', '$process_person_profile', '$geoip_disable', 'surface', 'guide'];
          event.properties = Object.fromEntries(Object.entries(event.properties || {}).filter(([key]) => allowed.includes(key)));
          event.properties.$current_url = options.origin + options.pathname;
          event.properties.$pathname = options.pathname;
          event.properties.$geoip_disable = true;
          return event;
        },
      };
      client.init(options.projectToken, config);
      initialized = true;
    }
    client.opt_in_capturing({ captureEventName: false });
    capture('$pageview');
  }

  return {
    available,
    get preference() { return preference; },
    start,
    setEnabled(enabled: boolean) {
      const next = enabled ? 'enabled' : 'disabled';
      if (preference === next) return;
      preference = next;
      try { options.storage.setItem(PREFERENCE_KEY, preference); } catch { /* Session-only choice. */ }
      if (enabled) start();
      else if (initialized) {
        client.reset();
        client.opt_out_capturing();
      }
    },
    trackGuide(guide: 'claude_code' | 'codex') { capture('installation_guide_opened', { guide }); },
  };
}
