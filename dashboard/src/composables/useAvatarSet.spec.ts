import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_STORAGE_KEY, useAvatarSet } from './useAvatarSet';
const { avatarSet, selectAvatarSet } = useAvatarSet();
beforeEach(() => { selectAvatarSet('editorial'); localStorage.clear(); });
describe('avatar preference', () => {
  it('updates all consumers and persists the selected family', () => {
    const secondWindowView = useAvatarSet();
    selectAvatarSet('mineral');
    expect([avatarSet.value, secondWindowView.avatarSet.value, localStorage.getItem(AVATAR_STORAGE_KEY)]).toEqual(['mineral', 'mineral', 'mineral']);
  });
  it('receives cross-window changes and falls back when the preference is cleared', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_STORAGE_KEY, newValue: 'matte' }));
    expect(avatarSet.value).toBe('matte');
    window.dispatchEvent(new StorageEvent('storage', { key: AVATAR_STORAGE_KEY, newValue: 'obsolete' }));
    expect(avatarSet.value).toBe('editorial');
    selectAvatarSet('matte');
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(avatarSet.value).toBe('editorial');
  });
  it('ignores unrelated storage changes', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'mineral' }));
    expect(avatarSet.value).toBe('editorial');
  });
  it('keeps the choice usable when persistence is unavailable', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    selectAvatarSet('animals');
    expect(avatarSet.value).toBe('animals');
    write.mockRestore();
  });
});
