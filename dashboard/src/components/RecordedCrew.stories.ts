import type { Meta, StoryObj } from "@storybook/vue3";
import { ref } from "vue";
import RecordedCrewScene from "./marketing/RecordedCrewScene.vue";

const meta: Meta<typeof RecordedCrewScene> = {
  title: "Synthetic Screenshots/Recorded Crew",
  component: RecordedCrewScene,
  parameters: { layout: "fullscreen" },
  args: { camera: true, compact: false, cameraZoom: 2 },
  argTypes: {
    cameraZoom: {
      name: "Camera zoom",
      description: "1× = full frame; 2× = central 50%; 2.5× = central 40%. Only the webcam crop changes.",
      control: { type: "range", min: 1, max: 4, step: 0.05 },
    },
  },
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
      <span>Camera {{ args.cameraZoom.toFixed(2) }}× · central {{ Math.round(100 / args.cameraZoom) }}% · adjust Camera zoom in Controls</span>
      </div><RecordedCrewScene ref="scene" v-bind="args" /></div>`,
  }),
};
