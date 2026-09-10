import { previewAccent } from "../src/composables/useAccentPalette";
import { accentPalettes, resolveAccent } from "../src/styles/accentPalettes";
import type { Preview } from "@storybook/vue3";
import "../src/styles/hud.css";
import "./preview.css";

// Render the same graphite surfaces as the desktop product.
const preview: Preview = {
  initialGlobals: { accent: 'amber' },
  globalTypes: {
    accent: { description: 'Shared app and website accent palette', toolbar: {
      title: 'Accent', icon: 'paintbrush', dynamicTitle: true, items: [...accentPalettes],
    } },
  },
  decorators: [(story, context) => {
    previewAccent(resolveAccent(context.globals.accent));
    return { components: { story }, template: '<story />' };
  }],
  parameters: {
    backgrounds: { disable: true },
    options: { storySort: { order: ['Product', 'Companion', 'HUD', 'Synthetic Screenshots'] } },
  },
};

export default preview;
