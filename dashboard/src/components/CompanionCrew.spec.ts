import { afterEach, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import CompanionCrewScene from "./marketing/CompanionCrewScene.vue";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("keeps playback opt-in and stops the old voice when changing beats", async () => {
  vi.useFakeTimers();
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  const wrapper = mount(CompanionCrewScene, { props: { manual: true } });
  expect(play).not.toHaveBeenCalled();
  wrapper.vm.step(1);
  await wrapper.vm.$nextTick();
  wrapper.vm.toggleSound();
  expect(play).toHaveBeenCalledTimes(1);
  expect((play.mock.contexts[0] as unknown as HTMLAudioElement).src).toContain(
    "lux-1.mp3",
  );
  wrapper.vm.step(1);
  await wrapper.vm.$nextTick();
  expect(pause).toHaveBeenCalled();
  wrapper.unmount();
});
