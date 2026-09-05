import type { Preview } from "@storybook/vue3";
import "../src/styles/hud.css";
import "./preview.css";

// Render the same graphite surfaces as the desktop product.
const preview: Preview = {
  parameters: {
    backgrounds: { disable: true },
    options: { storySort: { order: ['Product', 'Companion', 'HUD', 'Synthetic Screenshots'] } },
  },
};

export default preview;
