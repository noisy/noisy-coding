import type { Meta, StoryObj } from "@storybook/vue3";
import Splash from "./Splash.vue";

/* The launch splash (#96), round 2. Round 1's "A Mark" won on idea and lost
 * on balance (everything in a tight centre); B had no logo and a bar too
 * close to the name, C's name sat oddly, D's ring hid behind the name.
 * These four iterate on A only. The Electron window becomes 320x170. */
const meta: Meta<typeof Splash> = { component: Splash, title: "App/Splash" };
export default meta;

const at = (look: "mark" | "spaced" | "row" | "edge" | "icon-only"): StoryObj<typeof Splash> => ({
  args: { look },
  render: (args) => ({
    components: { Splash },
    setup: () => ({ args }),
    template: `<div style="padding:24px;background:#0b0c0e;display:inline-block;border-radius:12px"><Splash v-bind="args" style="border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.6)" /></div>`,
  }),
});

export const A_Mark_Round1 = at("mark");
export const E_Spaced = at("spaced");
export const F_Row = at("row");
export const G_EdgeLine = at("edge");
export const H_IconOnly = at("icon-only");
