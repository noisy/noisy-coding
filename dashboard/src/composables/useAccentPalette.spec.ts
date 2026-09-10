import { afterEach, expect, it, vi } from 'vitest';
import { ACCENT_STORAGE_KEY, initializeAccentPalette, useAccentPalette } from './useAccentPalette';
const { accent, selectAccent } = useAccentPalette();
afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(ACCENT_STORAGE_KEY); initializeAccentPalette(); });
it('persists a selected palette and restores it at startup', () => {
  selectAccent('rose');
  document.documentElement.dataset.accent = 'amber';
  initializeAccentPalette();
  expect([accent.value, document.documentElement.dataset.accent, localStorage.getItem(ACCENT_STORAGE_KEY)]).toEqual(['rose', 'rose', 'rose']);
});
it('receives changes from another window and resets deleted preferences', () => {
  localStorage.setItem(ACCENT_STORAGE_KEY, 'teal');
  window.dispatchEvent(new StorageEvent('storage', { key: ACCENT_STORAGE_KEY }));
  expect(document.documentElement.dataset.accent).toBe('teal');
  localStorage.removeItem(ACCENT_STORAGE_KEY);
  window.dispatchEvent(new StorageEvent('storage', { key: ACCENT_STORAGE_KEY }));
  expect(document.documentElement.dataset.accent).toBe('amber');
});
it('keeps selection usable if saving fails', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
  selectAccent('blue');
  expect([accent.value, document.documentElement.dataset.accent]).toEqual(['blue', 'blue']);
});
