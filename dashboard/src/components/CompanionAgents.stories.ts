import type { Meta, StoryObj } from "@storybook/vue3";
import Companion, { type CompanionAgent, type CompanionMessage } from "./Companion.vue";

/* Switching conversations from inside the widget (#28 follow-up).
 *
 * The dashboard has a tab per agent; the widget has room for none. So the
 * other conversations stack ABOVE the active portrait, smallest and dimmest
 * furthest away - the one you are in sits closest to the thread, where your
 * eye already is.
 *
 * Three variants of the same idea, to be picked by eye rather than argued
 * about: how strongly the stack should recede.
 */
const meta: Meta<typeof Companion> = {
  title: "Companion/Agent switcher",
  component: Companion,
};
export default meta;
type Story = StoryObj<typeof Companion>;

const FEED: CompanionMessage[] = [
  { role: "claude", text: "I'm ready." },
  { role: "user", text: "switch me to the word-up agent" },
  { role: "claude", text: "Tap a head above mine - the one you are in sits at the bottom." },
];

/* Only voices that HAVE a portrait in the sprite sheet - see #44. A mockup
   is for judging the design, and a blank disc judges the artwork instead. */
const OTHERS: CompanionAgent[] = [
  { name: "chat", voice: "eve" },
  { name: "talk-me-through", voice: "atlas", unread: true },
  { name: "word-up", voice: "iris" },
];

const base = { mode: "claude" as const, voice: "lux", feed: FEED, maxHeight: 200 };

/** The everyday view: the conversation you are in, plus three others. */
export const Stack: Story = { args: { ...base, agents: OTHERS } };

/** One other conversation - the common case, and the one that must not look odd. */
export const Two: Story = {
  args: { ...base, agents: [{ name: "chat", voice: "eve", unread: true }] },
};

/** Five, to see where the stack stops being readable. */
export const Crowded: Story = {
  args: {
    ...base,
    agents: [
      { name: "stream-day-2", voice: "rex" },
      { name: "chat", voice: "eve" },
      { name: "talk-me-through", voice: "atlas", unread: true },
      { name: "word-up", voice: "iris" },
      { name: "test16", voice: "kepler" },
    ],
  },
};
