import { readonly, ref } from 'vue';
import { resolveAccent } from '../styles/accentPalettes';

export const ACCENT_STORAGE_KEY = 'noisy-coding.accent';
export const AGENT_ACCENT_STORAGE_KEY = 'noisy-coding.agent-accent';
function readPreference(key = ACCENT_STORAGE_KEY, fallback = 'amber') {
  try { return resolveAccent(localStorage.getItem(key) ?? fallback); }
  catch { return fallback; }
}
const selected = ref(readPreference());
const agentSelected = ref(readPreference(AGENT_ACCENT_STORAGE_KEY, 'lavender'));
export function previewAgentAccent(value: unknown) {
  agentSelected.value = resolveAccent(value);
  document.documentElement.dataset.agentAccent = agentSelected.value;
}
export function previewAccent(value: unknown) {
  selected.value = resolveAccent(value);
  document.documentElement.dataset.accent = selected.value;
}
export function initializeAccentPalette() {
  previewAccent(readPreference());
  previewAgentAccent(readPreference(AGENT_ACCENT_STORAGE_KEY, 'lavender'));
}
function receivePreference(event: StorageEvent) {
  if (event.key === AGENT_ACCENT_STORAGE_KEY || event.key === null) previewAgentAccent(readPreference(AGENT_ACCENT_STORAGE_KEY, 'lavender'));
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
  function selectAgentAccent(value: string) {
    previewAgentAccent(value);
    try { localStorage.setItem(AGENT_ACCENT_STORAGE_KEY, agentSelected.value); }
    catch { /* Keep the selection usable when storage is unavailable. */ }
  }
  return { agentAccent: readonly(agentSelected), selectAgentAccent, accent: readonly(selected), selectAccent };
}
