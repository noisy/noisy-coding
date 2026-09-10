import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import RecordedHeroScene from './RecordedHeroScene.vue';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('drives the hero console and real companion from the same video when seeking', async () => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const wrapper = mount(RecordedHeroScene);
  try {
    const video = wrapper.get('video');
    expect(video.attributes('src')).toContain('hero-recording.mp4');
    (video.element as HTMLVideoElement).currentTime = 65;
    await video.trigger('seeked');
    expect(wrapper.text()).toContain("It's live in production. Search is working.");
    expect(wrapper.text()).toContain('Production deployment complete');
    (video.element as HTMLVideoElement).currentTime = 20;
    await video.trigger('seeked');
    expect(wrapper.text()).not.toContain('Production deployment complete');
    expect(wrapper.text()).toContain('src/search.ts');
    expect(wrapper.text()).not.toContain('pull-requests');
    expect(wrapper.text()).not.toMatch(/orderflow|webhook|suite/i);
    // The hero console was deliberately relabelled to a neutral "workspace"
    // (a1132dc, "Remove old project labels from the recorded hero") - the
    // title and cwd no longer name a project. Asserting the label, not the
    // old project name, so a future rename fails loudly rather than here.
    expect(wrapper.text()).toContain('workspace');
    expect(wrapper.text()).toContain('cwd: ~/projects/workspace');
  } finally { wrapper.unmount(); }
});
