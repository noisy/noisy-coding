import type { Meta, StoryObj } from "@storybook/vue3";
import { defineComponent, ref } from "vue";
import Companion, { type CompanionMessage } from "./Companion.vue";

const meta: Meta = { title: "Companion/PoC" };
export default meta;

const READY: CompanionMessage = { role: "claude", text: "I'm ready." };
const FOUR: CompanionMessage[] = [
  { role: "claude", text: "I'm ready." },
  { role: "user", text: "let's build the companion widget" },
  { role: "claude", text: "Storybook first - you pick, then I wire it in." },
  { role: "user", text: "keep it small, always on top" },
];

const USER_LINE = "okay so the next thing I want to build is the companion widget";
const CLAUDE_LINE = "On it - Storybook first, you pick, then I wire it in.";

/* ------------------------------------------------------------------ *
 * Interactive playground: drive the whole conversation flow by hand
 * or hit PLAY DEMO for the scripted loop (user talks word by word ->
 * message commits -> Claude replies -> idle).
 * ------------------------------------------------------------------ */
const Playground = defineComponent({
  components: { Companion },
  setup() {
    const mode = ref<"idle" | "user" | "claude">("idle");
    const feed = ref<CompanionMessage[]>([READY]);
    const liveText = ref("");
    let timers: number[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    const userStarts = () => { clear(); mode.value = "user"; liveText.value = ""; };
    const userWords = () => {
      mode.value = "user";
      const words = USER_LINE.split(" ");
      liveText.value = "";
      words.forEach((w, i) => later(220 * i, () => { liveText.value += (i ? " " : "") + w; }));
    };
    const userCommits = () => {
      feed.value = [...feed.value, { role: "user", text: liveText.value || USER_LINE }];
      liveText.value = ""; mode.value = "idle";
    };
    const claudeReplies = () => {
      mode.value = "claude";
      feed.value = [...feed.value, { role: "claude", text: CLAUDE_LINE }];
      later(2600, () => { mode.value = "idle"; });
    };
    const reset = () => { clear(); mode.value = "idle"; feed.value = [READY]; liveText.value = ""; };
    const demo = () => {
      reset();
      userStarts();
      later(400, userWords);
      later(400 + 220 * USER_LINE.split(" ").length + 700, userCommits);
      later(400 + 220 * USER_LINE.split(" ").length + 1400, claudeReplies);
    };

    return { mode, feed, liveText, userStarts, userWords, userCommits, claudeReplies, reset, demo };
  },
  template: `
    <div style="background:#02060c;padding:24px;min-height:340px;font-family:monospace">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        <button @click="demo" style="padding:6px 12px">▶ PLAY DEMO</button>
        <button @click="userStarts">1. user starts (listening)</button>
        <button @click="userWords">2. user words stream in</button>
        <button @click="userCommits">3. user message commits</button>
        <button @click="claudeReplies">4. claude replies</button>
        <button @click="reset">reset</button>
      </div>
      <Companion :mode="mode" :feed="feed" :live-text="liveText" voice="rex" :max-height="200" />
    </div>`,
});

export const Playground_Flow: StoryObj = { render: () => Playground };

const wrap = (props: Record<string, unknown>) => ({
  components: { Companion },
  setup: () => ({ props }),
  template: `<div style="background:#02060c;padding:24px;display:inline-block">
    <Companion v-bind="props" /></div>`,
});

export const MidConversation_Scrolled: StoryObj = {
  render: () => wrap({ mode: "idle", feed: FOUR, maxHeight: 170 }),
};
export const ClaudeSpeaking: StoryObj = {
  render: () => wrap({ mode: "claude", feed: FOUR }),
};
export const UserTalking_LiveTranscript: StoryObj = {
  render: () => wrap({
    mode: "user",
    feed: FOUR,
    liveText: "and it should stay small in the corner",
  }),
};
export const ColdStart_ImReady: StoryObj = {
  render: () => wrap({ mode: "idle", feed: [READY] }),
};
