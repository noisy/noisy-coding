import { flushPromises, mount } from "@vue/test-utils";
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

it("unmutes on mouse hover and mutes on leaving the whole screenshot", async () => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const wrapper = mount(RecordedCrewScene);
  try {
    const media = wrapper.get("video").element;
    expect(media.muted).toBe(true);
    await wrapper.trigger("pointerenter", { pointerType: "mouse" });
    expect([wrapper.vm.soundOn, media.muted]).toEqual([true, false]);
    await wrapper.trigger("pointerleave", { pointerType: "mouse" });
    expect([wrapper.vm.soundOn, media.muted]).toEqual([false, true]);
    await wrapper.trigger("pointerenter", { pointerType: "touch" });
    expect(media.muted).toBe(true);
  } finally { wrapper.unmount(); }
});

it("keeps a blocked hover silent and allows the sound button to retry", async () => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLMediaElement.prototype, "play")
    .mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"))
    .mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const wrapper = mount(RecordedCrewScene);
  try {
    await wrapper.trigger("pointerenter", { pointerType: "mouse" });
    await flushPromises();
    expect([wrapper.vm.soundOn, wrapper.get("video").element.muted]).toEqual([false, true]);
    expect(wrapper.text()).toContain("Click the sound button");
    await wrapper.vm.toggleSound();
    expect([wrapper.vm.soundOn, wrapper.get("video").element.muted]).toEqual([true, false]);
  } finally { wrapper.unmount(); }
});
