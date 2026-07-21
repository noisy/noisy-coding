import type { Meta, StoryObj } from "@storybook/vue3";
import CharacterReadout from "./CharacterReadout.vue";
import StatusStrip from "./StatusStrip.vue";

const meta: Meta = { title: "HUD/Readouts" };
export default meta;

export const Character: StoryObj = {
  render: () => ({
    components: { CharacterReadout },
    setup: () => ({
      character: { humor: 60, honesty: 80, brevity: 40, chatty: 100, voice: "altair", speed: 1.15 },
    }),
    template: `<div style="max-width:330px"><CharacterReadout :character="character" /></div>`,
  }),
};

export const Status: StoryObj = {
  render: () => ({
    components: { StatusStrip },
    setup: () => ({
      status: {
        listening: true, muted: false, recording: true, claude_speaking: false,
        speaking_agents: [], queued: 1, session_cost_usd: { user: 0.0021, claude: 0.0226 },
        credits_usd: 4.53, mode: "live", tts_mode: "live", end_silence_ms: 800, mic_sensitivity: 50,
        smart_turn: 0, smart_turn_mode: "soft", language: "pl", agents: {},
        agent_labels: {}, active_agent: null,
      },
    }),
    template: `<div style="max-width:330px"><StatusStrip :status="status" :offline="false" /></div>`,
  }),
};
