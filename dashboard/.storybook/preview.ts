import type { Preview } from "@storybook/vue3";
import "../src/styles/hud.css";

// Stories render on the HUD's dark chrome so components look like they do
// in the real app.
const preview: Preview = {
  parameters: {
    backgrounds: { disable: true },
  },
};

export default preview;
