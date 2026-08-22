import type { Meta, StoryObj } from "@storybook/vue3";
import ShutdownBanner from "./ShutdownBanner.vue";

const meta: Meta = { title: "HUD/ShutdownBanner" };
export default meta;

const wrap = (variant: string) => ({
  components: { ShutdownBanner },
  setup: () => ({ variant }),
  template: `<div style="max-width:960px;display:flex;flex-direction:column;gap:14px">
    <ShutdownBanner :variant="variant" label="4:52" />
    <ShutdownBanner :variant="variant" label="9s" />
  </div>`,
});

export const A_Strip: StoryObj = { render: () => wrap("strip") };
export const B_Hud: StoryObj = { render: () => wrap("hud") };
export const C_Hazard: StoryObj = { render: () => wrap("hazard") };
export const D_Card: StoryObj = { render: () => wrap("card") };
export const E_Glow: StoryObj = { render: () => wrap("glow") };
