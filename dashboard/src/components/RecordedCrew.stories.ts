import type { Meta, StoryObj } from "@storybook/vue3";
import { ref } from "vue";
import RecordedCrewScene from "./marketing/RecordedCrewScene.vue";

const meta: Meta<typeof RecordedCrewScene> = {
  title: "Synthetic Screenshots/Recorded Crew",
  component: RecordedCrewScene,
  parameters: { layout: "fullscreen" },
  args: { camera: true, compact: false },
};
export default meta;
export const RecordingV1: StoryObj<typeof RecordedCrewScene> = {
  render: args => ({
    components: { RecordedCrewScene },
    setup() {
      const scene = ref<InstanceType<typeof RecordedCrewScene>>();
      return { args, scene };
    },
    template: `<div><div style="padding:12px;display:flex;gap:12px;background:#18191e;color:white">
      <button @click="scene?.restart(); scene?.toggleSound()">Replay / toggle sound</button>
      <span>Recording V1 · center 50% crop · camera fixed to screenshot corner</span>
      </div><RecordedCrewScene ref="scene" v-bind="args" /></div>`,
  }),
};
