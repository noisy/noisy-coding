import { resolveAccent } from '@dashboard/styles/accentPalettes';

// Local Storybook previews share one palette across the page and embedded dashboard.
const accent = resolveAccent(new URLSearchParams(location.search).get('accent'));
export const accentPreviewQuery = import.meta.env.DEV ? `?accent=${accent}` : '';
export function applyPreviewAccent() {
  if (import.meta.env.DEV) document.documentElement.dataset.accent = accent;
}
