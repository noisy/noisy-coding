import { readonly, ref } from 'vue';
import { resolveAccent } from '../styles/accentPalettes';

export const ACCENT_STORAGE_KEY = 'noisy-coding.accent';
function readPreference() {
  try { return resolveAccent(localStorage.getItem(ACCENT_STORAGE_KEY)); }
  catch { return 'amber'; }
}
const selected = ref(readPreference());
export function previewAccent(value: unknown) {
  selected.value = resolveAccent(value);
  document.documentElement.dataset.accent = selected.value;
}
export function initializeAccentPalette() { previewAccent(readPreference()); }
function receivePreference(event: StorageEvent) {
  if (event.key === ACCENT_STORAGE_KEY || event.key === null) previewAccent(readPreference());
}
if (typeof window !== 'undefined') window.addEventListener('storage', receivePreference);
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener('storage', receivePreference));

export function useAccentPalette() {
  function selectAccent(value: string) {
    previewAccent(value);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, selected.value); }
    catch { /* Keep the selection usable when browser storage is unavailable. */ }
  }
  return { accent: readonly(selected), selectAccent };
}
