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

// #97 - keys are configured but macOS has not granted Input Monitoring.
// Three looks for the notice; the AUDIO tab holds the key pickers.
const blocked = { configured: true, permission: "missing" as const, armed: false };
const hotkeyArgs = { apiKeyHint: "····kRc9", pttHoldKey: "F8", pttToggleKey: "F15", pttCancelKey: "escape", hotkeys: blocked };
export const HotkeysBlockedInline: StoryObj<typeof SettingsView> = {
  args: { ...hotkeyArgs, hotkeyNoticeLook: "inline" },
  render: Configured.render,
};
export const HotkeysBlockedCallout: StoryObj<typeof SettingsView> = {
  args: { ...hotkeyArgs, hotkeyNoticeLook: "callout" },
  render: Configured.render,
};
export const HotkeysBlockedRow: StoryObj<typeof SettingsView> = {
  args: { ...hotkeyArgs, hotkeyNoticeLook: "row" },
  render: Configured.render,
};
export const HotkeysArmed: StoryObj<typeof SettingsView> = {
  args: { ...hotkeyArgs, hotkeys: { configured: true, permission: "granted", armed: true } },
  render: Configured.render,
};
