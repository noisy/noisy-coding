import type { Meta, StoryObj } from "@storybook/vue3";
import ProviderSettings from "./ProviderSettings.vue";
import type { ProvidersInfo } from "../api/client";

// The component fetches /providers itself (self-contained by design), so
// each story stubs window.fetch with a canned daemon answer. POSTs echo
// the switch back, so picking engines works inside Storybook too.
function stubFetch(info: ProvidersInfo | null) {
  const state = info ? structuredClone(info) : null;
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (state === null) return new Response("not found", { status: 404 });
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}"));
      if (body.tts) state.active.tts = body.tts;
      if (body.stt) state.active.stt = body.stt;
      return Response.json(state.active);
    }
    return Response.json(state);
  }) as typeof window.fetch;
}

const GROK = {
  name: "grok",
  kind: "cloud-api" as const,
  label: "Grok (xAI)",
  directions: ["tts", "stt"] as ("tts" | "stt")[],
  streaming: { tts: true, stt: true },
  ready: true,
  fields: [
    { key: "xai_api_key", kind: "secret" as const, label: "xAI API key", required: true },
  ],
};

const LOCAL = {
  name: "local",
  kind: "local" as const,
  label: "Local (offline)",
  directions: ["tts", "stt"] as ("tts" | "stt")[],
  streaming: { tts: false, stt: false },
  ready: true,
  fields: [
    {
      key: "stt_model", kind: "choice" as const, label: "Whisper model",
      required: false, options: ["tiny", "base", "small", "medium", "large-v3"],
      value: "small",
    },
    {
      key: "tts_voice", kind: "choice" as const, label: "Kokoro voice",
      required: false, options: ["af_sarah", "af_heart", "am_adam", "bf_emma"],
      value: "af_sarah",
    },
  ],
};

const meta: Meta<typeof ProviderSettings> = {
  component: ProviderSettings,
  title: "HUD/ProviderSettings",
};
export default meta;

function story(info: ProvidersInfo | null): StoryObj<typeof ProviderSettings> {
  return {
    render: () => ({
      components: { ProviderSettings },
      setup: () => stubFetch(info),
      template: `<div style="max-width:720px"><ProviderSettings /></div>`,
    }),
  };
}

/** Default install: Grok both ways, key configured. */
export const GrokActive = story({
  catalog: [GROK, LOCAL],
  active: { tts: "grok", stt: "grok" },
});

/** Fully offline: local engines picked, their option fields visible. */
export const LocalActive = story({
  catalog: [GROK, LOCAL],
  active: { tts: "local", stt: "local" },
});

/** Nothing configured yet: no key, no optional install — both flagged. */
export const NothingReady = story({
  catalog: [{ ...GROK, ready: false }, { ...LOCAL, ready: false }],
  active: { tts: "grok", stt: "grok" },
});

/** Mixed setup: local ears (free transcription), Grok's voices out loud. */
export const MixedLocalSttGrokTts = story({
  catalog: [GROK, LOCAL],
  active: { tts: "grok", stt: "local" },
});

/** Kokoro's weights mid-flight: byte-accurate bar plus whisper's coarse
 * "downloading" pulse. */
export const Downloading = story({
  catalog: [GROK, LOCAL],
  active: { tts: "local", stt: "local" },
  downloads: [
    {
      name: "kokoro-v1.0.onnx", label: "Kokoro voice model (kokoro-v1.0.onnx)",
      state: "downloading", done_bytes: 130 * 1024 * 1024,
      total_bytes: 326 * 1024 * 1024, detail: "",
    },
    {
      name: "whisper-small", label: "Whisper model (small)",
      state: "downloading", done_bytes: 0, total_bytes: 0, detail: "",
    },
  ],
});

/** Everything on disk: green checkmarks with sizes. */
export const ModelsDownloaded = story({
  catalog: [GROK, LOCAL],
  active: { tts: "local", stt: "local" },
  downloads: [
    {
      name: "kokoro-v1.0.onnx", label: "Kokoro voice model (kokoro-v1.0.onnx)",
      state: "done", done_bytes: 326 * 1024 * 1024,
      total_bytes: 326 * 1024 * 1024, detail: "",
    },
    {
      name: "voices-v1.0.bin", label: "Kokoro voice model (voices-v1.0.bin)",
      state: "done", done_bytes: 27 * 1024 * 1024,
      total_bytes: 27 * 1024 * 1024, detail: "",
    },
    { name: "whisper-small", label: "Whisper model (small)", state: "done",
      done_bytes: 0, total_bytes: 0, detail: "" },
  ],
});

/** A fetch that died mid-way: the failure stays visible, never hidden. */
export const DownloadFailed = story({
  catalog: [GROK, LOCAL],
  active: { tts: "local", stt: "local" },
  downloads: [
    {
      name: "kokoro-v1.0.onnx", label: "Kokoro voice model (kokoro-v1.0.onnx)",
      state: "error", done_bytes: 0, total_bytes: 0,
      detail: "connection reset by peer",
    },
  ],
});

/** An old daemon without /providers: the section hides, no error shown. */
export const OldDaemon = story(null);
