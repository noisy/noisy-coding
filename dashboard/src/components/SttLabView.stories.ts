import type { Meta, StoryObj } from "@storybook/vue3";
import SttLabView from "./SttLabView.vue";

/** The one-button STT consistency sweep. Stories mock /stt-lab/run so the
 *  states render without a daemon (and without 30 real transcriptions). */
const meta: Meta<typeof SttLabView> = {
  title: "HUD/STT Lab",
  component: SttLabView,
  parameters: { layout: "fullscreen" },
};
export default meta;

const respond = (payload: unknown, delayMs = 300) => {
  window.fetch = () =>
    new Promise((resolve) =>
      setTimeout(
        () => resolve(new Response(JSON.stringify(payload))),
        delayMs,
      ),
    );
};

export const AllGreen: StoryObj = {
  render: () => ({
    components: { SttLabView },
    setup: () =>
      respond({
        engine: "Grok STT", files: 2, runs_per_path: 3, worst: 0.999,
        verdict: "PASS",
        rows: [
          { file: "20260902-0624-u94.wav", text: "I would like to run those tests interactively.", batch: 1.0, live: 0.999,
            live_diff: "[-dashboard|+dashboard.]" },
          { file: "20260902-0621-u88.wav", text: "Okay, that's great.", batch: 1.0, live: 1.0 },
        ],
      }),
    template: "<SttLabView />",
  }),
};

export const FailingSweep: StoryObj = {
  render: () => ({
    components: { SttLabView },
    setup: () =>
      respond({
        engine: "Grok STT", files: 1, runs_per_path: 3, worst: 0.71,
        verdict: "FAIL",
        rows: [
          { file: "20260902-0619-u87.wav", text: "the daemon should preload the widgets", batch: 0.71, live: 0.8,
            batch_diff: "[-preload|+reload] [-widgets|+wickets]" },
        ],
      }),
    template: "<SttLabView />",
  }),
};

export const EmptyArchive: StoryObj = {
  render: () => ({
    components: { SttLabView },
    setup: () => respond({ error: "no recordings archived yet - speak to the daemon first" }),
    template: "<SttLabView />",
  }),
};
