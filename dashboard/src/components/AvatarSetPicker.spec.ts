import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AvatarSetPicker from './AvatarSetPicker.vue';
import { AVATAR_VOICES } from '../avatars/catalog';

describe('avatar family browser', () => {
  it('shows every named voice and updates the complete preview when a family is selected', async () => {
    const wrapper = mount(AvatarSetPicker);
    await wrapper.get('input[value="blobs"]').setValue(true);
    expect(wrapper.findAll('.voice-preview > span:last-child').map(node => node.text())).toEqual(AVATAR_VOICES);
    expect(wrapper.findAll('.voice-preview img').every(node => node.attributes('src')?.includes('blobs.png'))).toBe(true);
    wrapper.unmount();
  });
});
