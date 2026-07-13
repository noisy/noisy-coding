import type { Meta, StoryObj } from "@storybook/vue3";
import AgentTabs from "./AgentTabs.vue";

const meta: Meta<typeof AgentTabs> = {
  component: AgentTabs,
  title: "HUD/AgentTabs",
};
export default meta;

export const ThreeAgents: StoryObj<typeof AgentTabs> = {
  args: {
    agents: { a: "noisy-coding-stabilization", b: "personal", c: "work" },
    active: "a",
    viewed: "b",
    speaking: ["c"],
  },
};
