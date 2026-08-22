import type { Meta, StoryObj } from "@storybook/vue3";
import Companion from "./Companion.vue";

const meta: Meta = { title: "Companion/PoC" };
export default meta;

const NOW = "Fix is written and all tests pass - want me to push it?";
const OLDER = "Found the race: the in-flight poll delivers the old tab's list.";

const wrap = (props: Record<string, unknown>) => ({
  components: { Companion },
  setup: () => ({ props }),
  template: `<div style="background:#02060c;padding:24px;display:inline-block">
    <Companion v-bind="props" /></div>`,
});

export const ClaudeSpeaking_Stacked: StoryObj = {
  render: () => wrap({ mode: "claude", avatar: "circle", messages: [OLDER, NOW], voice: "rex" }),
};
export const ClaudeSpeaking_SquareHead: StoryObj = {
  render: () => wrap({ mode: "claude", avatar: "square", messages: [OLDER, NOW], voice: "rex" }),
};
export const UserTalking_LiveTranscript: StoryObj = {
  render: () => wrap({ mode: "user", liveText: "okay so the next thing I want to build is" }),
};
export const UserTalking_NoWordsYet: StoryObj = {
  render: () => wrap({ mode: "user" }),
};
export const Idle: StoryObj = {
  render: () => wrap({ mode: "idle" }),
};
