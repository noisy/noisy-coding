import type { Meta, StoryObj } from "@storybook/vue3";
import { computed, defineComponent, onMounted, onUnmounted, type PropType } from "vue";
import Companion, { type CompanionAgent, type CompanionMessage } from "./Companion.vue";

/* Synthetic screenshots: the widget over a wallpaper-like backdrop.
 *
 * ONE story; the combinations live in the controls. Pick a backdrop and a
 * content preset from the dropdowns, or paste a scenario JSON to override
 * the preset entirely - the scenario object describes the whole scene:
 * messages, agents rail, and widget mode. scripts/marketing-shots.sh
 * captures the shipped combos by passing the same args in the story URL.
 */
const meta: Meta = {
  title: "Synthetic Screenshots/Companion",
  parameters: { layout: "fullscreen" },
};
export default meta;

/* ---- backdrops ------------------------------------------------------ */

export const BACKDROPS: Record<string, string> = {
  /** Deep space navy/purple, like the brand wallpapers. */
  space:
    "radial-gradient(1200px 700px at 20% 15%, #2a2350 0%, transparent 55%)," +
    "radial-gradient(900px 600px at 85% 80%, #1b2a4a 0%, transparent 60%)," +
    "linear-gradient(160deg, #0b0d1f 0%, #141334 55%, #0a0f24 100%)",
  /** Warm dusk - orange sinking into violet. */
  dusk:
    "radial-gradient(1000px 650px at 75% 20%, rgba(255,138,76,0.35) 0%, transparent 60%)," +
    "linear-gradient(165deg, #3b1d3f 0%, #6b2d52 40%, #b4553f 78%, #d98a4e 100%)",
  /** Subtle dark mesh - near-black with faint cool blooms. */
  mesh:
    "radial-gradient(800px 500px at 30% 70%, rgba(56,89,138,0.25) 0%, transparent 60%)," +
    "radial-gradient(700px 450px at 80% 25%, rgba(88,64,128,0.22) 0%, transparent 55%)," +
    "linear-gradient(150deg, #0d0f14 0%, #131722 60%, #0c0e13 100%)",
};

/* ---- content presets -------------------------------------------------
 *
 * One JSON object per scene: everything the widget needs. The same shape
 * works pasted into the `scenario` control.
 */

export interface Scenario {
  mode: "claude" | "idle";
  feed: CompanionMessage[];
  agents: CompanionAgent[];
}

const AGENTS: CompanionAgent[] = [
  { name: "stream-day-2", voice: "lux", active: true },
  { name: "chat", voice: "eve" },
  { name: "talk-me-through", voice: "atlas", unread: true },
];

const AGENTS_TWO: CompanionAgent[] = [
  { name: "release-3-0", voice: "lux", active: true },
  { name: "chat", voice: "eve", unread: true },
];

export const PRESETS: Record<string, Scenario> = {
  "fixing-tests": {
    mode: "claude",
    agents: AGENTS,
    feed: [
      { id: 1, role: "claude", text: "Two tests still red - the mock returns a list now. Fixing the fixture." },
      { id: 2, role: "user", text: "go ahead, then rerun just that file" },
    ],
  },
  "code-review": {
    mode: "claude",
    agents: AGENTS,
    feed: [
      { id: 1, role: "claude", text: "The retry loop swallows the timeout error. Want me to surface it instead?" },
      { id: 2, role: "user", text: "yes, and add a test for it" },
    ],
  },
  "long-refactor": {
    mode: "claude",
    agents: AGENTS,
    feed: [
      { id: 1, role: "claude", text: "Migration done for 14 of 23 call sites. The tricky one is the websocket handler." },
      { id: 2, role: "user", text: "take the websocket one next" },
    ],
  },
  "away-from-keyboard": {
    mode: "claude",
    agents: AGENTS_TWO,
    feed: [
      { id: 1, role: "user", text: "status?" },
      { id: 2, role: "claude", text: "Build is green. I'm halfway through the changelog - back to you in five." },
    ],
  },
  shipping: {
    mode: "idle",
    agents: AGENTS_TWO,
    feed: [
      { id: 1, role: "user", text: "wrap it up" },
      { id: 2, role: "claude", text: "Release 3.0 draft is up: two features, one fix. Read it aloud?" },
    ],
  },
};

/* ---- the frame ------------------------------------------------------- */

/** A 1200x760 crop of a desktop with the widget floating in it. */
const Shot = defineComponent({
  components: { Companion },
  props: {
    backdrop: { type: String, required: true },
    preset: { type: String, required: true },
    scenario: { type: Object as PropType<Scenario | null>, default: null },
  },
  setup(props) {
    // The widget ships without chrome of its own; transparent mode is how
    // it really looks floating over a desktop.
    onMounted(() => document.body.classList.add("companion-transparent"));
    onUnmounted(() => document.body.classList.remove("companion-transparent"));

    const scene = computed<Scenario>(
      () => props.scenario ?? PRESETS[props.preset] ?? PRESETS["fixing-tests"],
    );
    const background = computed(() => BACKDROPS[props.backdrop] ?? BACKDROPS.space);
    return { scene, background };
  },
  template: `
    <div :style="{
      width: '1200px', height: '760px', background,
      borderRadius: '18px', overflow: 'hidden', position: 'relative',
      boxShadow: 'inset 0 0 180px rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }">
      <Companion :mode="scene.mode" voice="lux" :feed="scene.feed"
                 :agents="scene.agents" :max-height="220" />
    </div>
  `,
});

export const Widget: StoryObj = {
  argTypes: {
    backdrop: { control: "select", options: Object.keys(BACKDROPS) },
    preset: { control: "select", options: Object.keys(PRESETS) },
    /** Full scene as JSON - overrides the preset when set. */
    scenario: { control: "object" },
  },
  args: { backdrop: "space", preset: "fixing-tests", scenario: null },
  render: (args) => ({
    components: { Shot },
    setup: () => ({ args }),
    template: `<Shot :backdrop="args.backdrop" :preset="args.preset" :scenario="args.scenario" />`,
  }),
};
