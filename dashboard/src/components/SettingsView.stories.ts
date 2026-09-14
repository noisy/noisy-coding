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

// Plain-web deployments opt in to the dashboard tab as a speaker/microphone
// (NOISY_CODING_BROWSER_AUDIO=1); the native app never shows this option (#99).
export const BrowserAudioAllowed: StoryObj<typeof SettingsView> = {
  args: { apiKeyHint: "····kRc9", browserAudio: true, outputDevice: "browser" },
  render: Configured.render,
};
