import type { StorybookConfig } from "@storybook/vue3-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|js)"],
  // Essentials brings the Controls panel - the synthetic-screenshot
  // stories are driven through it (backdrop/preset/scenario args).
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/vue3-vite", options: {} },
  viteFinal(config) {
    // Every Storybook surface is isolated from the user's running daemon.
    const ignored = config.server?.watch?.ignored;
    config.server = {
      ...config.server,
      proxy: {},
      watch: {
        ...config.server?.watch,
        // Validation builds must not reload the user's development preview.
        ignored: [...(Array.isArray(ignored) ? ignored : ignored ? [ignored] : []), '**/storybook-static/**'],
      },
    };
    config.resolve = { ...config.resolve, alias: [
      { find: /^.*\/api\/client$/, replacement: fileURLToPath(new URL('../src/storybook/daemon.fixture.ts', import.meta.url)) },
      { find: /^.*\/composables\/useMicStream$/, replacement: fileURLToPath(new URL('../src/storybook/mic.fixture.ts', import.meta.url)) },
    ] };
    return config;
  },
};

export default config;
