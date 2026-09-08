import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import VoicePersona from './VoicePersona.vue';

describe('VoicePersona mute controls', () => {
  it.each(['lux', 'unknown-voice'])('keeps the %s portrait an accessible mute action', async voice => {
    const wrapper = mount(VoicePersona, { props: { voice, muted: true } });
    const portrait = wrapper.get('button[aria-label="Unmute this conversation"]');
    expect(portrait.attributes('aria-pressed')).toBe('true');
    await portrait.trigger('click');
    expect(wrapper.emitted('toggle-mute')).toEqual([[]]);
  });
});
