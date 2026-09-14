import type { Meta, StoryObj } from "@storybook/vue3";
import Splash from "./Splash.vue";

/* The launch splash (#96). Four looks at the window's real size (the
 * Electron frameless window is 320x150). Pick one; the others go. None says
 * "daemon": the user sees that the app is alive, nothing they cannot act on. */
const meta: Meta<typeof Splash> = { component: Splash, title: "App/Splash" };
export default meta;

const at = (look: "mark" | "wordmark" | "card" | "pulse"): StoryObj<typeof Splash> => ({
  args: { look },
  render: (args) => ({
    components: { Splash },
    setup: () => ({ args }),
    template: `<div style="padding:24px;background:#0b0c0e;display:inline-block;border-radius:12px"><Splash v-bind="args" style="border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.6)" /></div>`,
  }),
});

export const A_Mark = at("mark");
export const B_Wordmark = at("wordmark");
export const C_Card = at("card");
export const D_Pulse = at("pulse");
