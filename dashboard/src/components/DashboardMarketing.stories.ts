import type { Meta, StoryObj } from "@storybook/vue3";
import DashboardMock from "./marketing/DashboardMock.vue";

/* The website hero shot: dashboard CONTENT only, no OS chrome.
 *
 * The landing pages wrap screenshots in their own CSS window frame, so a
 * capture that carries a macOS title bar ends up double-framed. This story
 * renders the bare dashboard at 1600x1000 for scripts/marketing-shots.sh.
 */
const meta: Meta = {
  title: "Synthetic Screenshots/App",
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Content: StoryObj = {
  render: () => ({
    components: { DashboardMock },
    template: `<DashboardMock />`,
  }),
};
