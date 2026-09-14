import type { Meta, StoryObj } from "@storybook/vue3";
import SettingsView from "./SettingsView.vue";

const meta: Meta<typeof SettingsView> = {
  component: SettingsView,
  title: "HUD/SettingsView",
};
export default meta;

export const Configured: StoryObj<typeof SettingsView> = {
  args: { apiKeyHint: "····kRc9" },
  render: (args) => ({
    components: { SettingsView },
    setup: () => ({ args }),
    template: `<div style="max-width:720px"><SettingsView v-bind="args" /></div>`,
  }),
};

export const NativeApp: StoryObj<typeof SettingsView> = {
  args: {
    apiKeyHint: "····kRc9",
    nativeApp: true,
    devices: [{ name: "MacBook Microphone", default: true }],
    selectedDevice: "",
    outputDevice: "system",
  },
  render: Configured.render,
};
