import type { Meta, StoryObj } from "@storybook/vue3";
import type { Utterance } from "../types";
import ClaudeBubble from "./ClaudeBubble.vue";
import UserBubble from "./UserBubble.vue";

const meta: Meta = { title: "HUD/Bubbles" };
export default meta;

function utterance(overrides: Partial<Utterance>): Utterance {
  return {
    id: 1,
    role: "user",
    status: "delivered to Claude",
    text: "Okej, odpal deploy na staging i daj znać jak skończy.",
    detail: "STT 0.9 s · 6.4 s AUDIO",
    cost_usd: 0.0004,
    agent: null,
    started_at: Date.now() / 1000,
    updated_at: Date.now() / 1000,
    committed_at: Date.now() / 1000,
    ...overrides,
  };
}

const feedStyle = "display:flex; flex-direction:column; gap:12px; max-width:720px";

export const Recording: StoryObj = {
  render: () => ({
    components: { UserBubble },
    setup: () => ({ u: utterance({ status: "recording…", text: "No dobra, to teraz przejdźmy do refaktoru", cost_usd: 0 }) }),
    template: `<div style="${feedStyle}"><UserBubble :utterance="u" /></div>`,
  }),
};

export const Delivered: StoryObj = {
  render: () => ({
    components: { UserBubble },
    setup: () => ({ u: utterance({}) }),
    template: `<div style="${feedStyle}"><UserBubble :utterance="u" /></div>`,
  }),
};

export const ClaudeSynthesizing: StoryObj = {
  render: () => ({
    components: { ClaudeBubble },
    setup: () => ({
      u: utterance({ role: "claude", status: "synthesizing (Grok TTS)…", text: "", cost_usd: 0 }),
    }),
    template: `<div style="${feedStyle}"><ClaudeBubble :utterance="u" /></div>`,
  }),
};

export const ClaudePlayed: StoryObj = {
  render: () => ({
    components: { ClaudeBubble },
    setup: () => ({
      u: utterance({
        role: "claude",
        status: "played",
        text: "[altair] „Pipeline #48210 passed — 214 tests green.”",
        detail: "streaming from Grok TTS",
        cost_usd: 0.0038,
      }),
    }),
    template: `<div style="${feedStyle}"><ClaudeBubble :utterance="u" /></div>`,
  }),
};
