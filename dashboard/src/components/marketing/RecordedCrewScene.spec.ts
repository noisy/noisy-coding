import { mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import RecordedCrewScene from "./RecordedCrewScene.vue";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("uses one media clock and turns sound off when the scene leaves view", async () => {
  let observe!: IntersectionObserverCallback;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { observe = callback; }
    observe() {} disconnect() {}
  });
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const wrapper = mount(RecordedCrewScene);
  try {
    expect(play).not.toHaveBeenCalled();
    await wrapper.vm.toggleSound();
    const media = wrapper.get("video").element;
    expect([wrapper.vm.soundOn, media.muted]).toEqual([true, false]);
    media.currentTime = 5;
    await wrapper.get("video").trigger("timeupdate");
    expect(wrapper.text()).toContain("Green! Ready to promote.");
    observe([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver);
    expect([wrapper.vm.soundOn, media.muted]).toEqual([false, true]);
    expect(pause).toHaveBeenCalled();
    wrapper.vm.restart();
    expect(media.currentTime).toBe(0);
    expect(wrapper.findAll("audio")).toHaveLength(0);
  } finally { wrapper.unmount(); }
});
