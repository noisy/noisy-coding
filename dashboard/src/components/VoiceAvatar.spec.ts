import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import VoiceAvatar from './VoiceAvatar.vue';

describe('VoiceAvatar fallback', () => {
  it('renders the new pool voices with artwork', () => {
    for (const voice of ['aurora', 'liora']) {
      const wrapper = mount(VoiceAvatar, { props: { voice } });
      expect(wrapper.find('img').exists()).toBe(true);
      wrapper.unmount();
    }
  });
  it('shows a readable monogram and development warning for an unknown voice', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = mount(VoiceAvatar, { props: { voice: 'future' } });
    expect(wrapper.text()).toBe('FUT');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('future'));
    wrapper.unmount(); warning.mockRestore();
  });
  it('falls back on an image failure and recovers when another set is selected', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = mount(VoiceAvatar, { props: { voice: 'iris', set: 'editorial' } });
    await wrapper.get('img').trigger('error');
    expect(wrapper.text()).toBe('IRI');
    await wrapper.setProps({ set: 'animals' });
    expect(wrapper.find('img').exists()).toBe(true);
    wrapper.unmount(); warning.mockRestore();
  });
});
