import posthog from 'posthog-js';
import { createWebsiteAnalytics, EXCLUSION_KEY, PREFERENCE_KEY } from './controller';

export const websiteAnalytics = createWebsiteAnalytics(posthog, {
  ...__POSTHOG_CONFIG__,
  production: import.meta.env.PROD,
  storage: {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  },
  origin: window.location.origin,
  pathname: window.location.pathname,
  excludeThisBrowser: new URLSearchParams(window.location.search).get('analytics') === 'off',
});

window.addEventListener('storage', (event) => {
  if (event.key === EXCLUSION_KEY) websiteAnalytics.setExcluded(event.newValue === 'true');
  if (event.key === PREFERENCE_KEY && event.newValue !== 'enabled') websiteAnalytics.setEnabled(false);
});
