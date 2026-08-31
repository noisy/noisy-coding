import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|js)"],
  // Essentials brings the Controls panel - the synthetic-screenshot
  // stories are driven through it (backdrop/preset/scenario args).
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/vue3-vite", options: {} },
};

export default config;
