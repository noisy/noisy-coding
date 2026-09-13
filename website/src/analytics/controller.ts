import type { PostHog, PostHogConfig } from 'posthog-js';

export const PREFERENCE_KEY = 'noisy-usage-analytics';
export const EXCLUSION_KEY = 'noisy-exclude-analytics';
type Client = Pick<PostHog, 'init' | 'capture' | 'opt_in_capturing' | 'opt_out_capturing' | 'reset'>;
const EVENTS = ['$pageview', 'installation_guide_opened', 'page_scrolled', 'scroll_depth_reached', 'video_demo_interacted', 'get_started_clicked', 'download_clicked'] as const;
type Preference = 'enabled' | 'disabled' | null;

export function createWebsiteAnalytics(client: Client, options: {
  projectToken: string;
  host: string;
  production: boolean;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  origin: string;
  pathname: string;
  excludeThisBrowser?: boolean;
}) {
  const available = options.production && Boolean(options.projectToken);
  let preference: Preference = null;
  try {
    const stored = options.storage.getItem(PREFERENCE_KEY);
    if (stored === 'enabled' || stored === 'disabled') preference = stored;
  } catch { /* Storage can be blocked; the current visit can still opt in. */ }
  let initialized = false;
  let excluded = options.excludeThisBrowser === true;
  try {
    if (excluded) options.storage.setItem(EXCLUSION_KEY, 'true');
    else excluded = options.storage.getItem(EXCLUSION_KEY) === 'true';
  } catch { /* Keep the in-memory exclusion if storage is unavailable. */ }

  function capture(event: typeof EVENTS[number], properties: Record<string, string | number> = {}) {
    if (!available || excluded || preference !== 'enabled' || !initialized) return;
    try { client.capture(event, { ...properties, surface: 'website' }); } catch { /* Analytics must not interrupt navigation. */ }
  }

  function start() {
    if (!available || excluded || preference !== 'enabled') return;
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
          if (!event || !EVENTS.includes(event.event as typeof EVENTS[number])) return null;
          // The browser SDK carries its ingestion token inside properties.
          const allowed = ['token', 'distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version', '$process_person_profile', '$geoip_disable', 'surface', 'guide', 'depth_percent', 'demo', 'action', 'placement', 'platform'];
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
    get enabled() { return available && initialized && !excluded && preference === 'enabled'; },
    get preference() { return preference; },
    get excluded() { return excluded; },
    start,
    setExcluded(value: boolean) {
      excluded = value;
      try { options.storage.setItem(EXCLUSION_KEY, String(value)); } catch { /* Session-only exclusion. */ }
      this.setEnabled(false);
    },
    setEnabled(enabled: boolean) {
      if (enabled && excluded) return;
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
    trackScroll() { capture('page_scrolled'); },
    trackDepth(depth: number) { capture('scroll_depth_reached', { depth_percent: depth }); },
    trackDemo(demo: 'hero' | 'crew', action: 'play' | 'pause' | 'mute' | 'unmute') { capture('video_demo_interacted', { demo, action }); },
    trackGetStarted(placement: 'header' | 'hero') { capture('get_started_clicked', { placement }); },
    trackDownload(platform: 'mac' | 'windows' | 'linux', placement: 'header' | 'hero' | 'install') { capture('download_clicked', { platform, placement }); },
    trackGuide(guide: 'claude_code' | 'codex') { capture('installation_guide_opened', { guide }); },
  };
}
