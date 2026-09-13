import posthog from 'posthog-js';
import { createWebsiteAnalytics } from './controller';

export const websiteAnalytics = createWebsiteAnalytics(posthog, {
  ...__POSTHOG_CONFIG__,
  production: import.meta.env.PROD,
  storage: {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  },
  origin: window.location.origin,
  pathname: window.location.pathname,
});
