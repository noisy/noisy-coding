import type { Meta, StoryObj } from "@storybook/vue3";
import HotkeysSettings, { type HotkeyGroup } from "./HotkeysSettings.vue";

/* Settings > Hotkeys (#104): three layouts x the states that matter.
 * Pick a layout; the states are the same in each. */
const meta: Meta<typeof HotkeysSettings> = { component: HotkeysSettings, title: "HUD/Hotkeys tab" };
export default meta;

const groups = (over: Partial<Record<string, Partial<HotkeyGroup["bindings"][number]>>> = {}): HotkeyGroup[] => {
  const b = (action: string, label: string, chord: string, extra: object = {}) => ({ action, label, chord, ...extra, ...(over[action] ?? {}) });
  return [
    {
      id: "talk", title: "Push to talk",
      caption: "System-wide, whichever app has focus. HOLD opens the mic while the key is down; TOGGLE opens on one press and closes on the next; SCRATCH throws away the recording in progress.",
      bindings: [b("hold", "Hold-to-talk", "F8"), b("toggle", "Toggle-to-talk", "F15"), b("scratch", "Scratch", "escape")],
    },
    {
      id: "tabs", title: "Talk to a tab",
      caption: "One key per conversation, counted left to right on the tab strip. Pressing it selects that conversation and opens the mic in toggle mode; press again to close, press another tab's key to hand the mic over.",
      bindings: [b("tab1", "Tab 1", "F1"), b("tab2", "Tab 2", "F2"), b("tab3", "Tab 3", "F3"), b("tab4", "Tab 4", "F4")],
    },
    {
      id: "app", title: "Companion window",
      caption: "Handled by the app itself, listed here so the whole keyboard map is in one place.",
      bindings: [b("ghost", "Ghost mode", "ctrl+alt+G", { readonly: true }), b("resize", "Cycle size", "ctrl+alt+R", { readonly: true })],
    },
  ];
};

const wrap = (args: object) => ({
  components: { HotkeysSettings },
  setup: () => ({ args }),
  template: `<div style="max-width:760px"><HotkeysSettings v-bind="args" /></div>`,
});
const story = (layout: "list" | "cards" | "table", state: object): StoryObj<typeof HotkeysSettings> => ({
  args: { layout, groups: groups(), permission: "granted", ...state },
  render: (args) => wrap(args),
});

// --- Layout A: list (groups stacked, 112px label column like the rest of Settings)
export const A_List = story("list", {});
export const A_List_Locked = story("list", { permission: "missing" });
export const A_List_Capturing = story("list", { capturing: "tab2" });
export const A_List_Collision = story("list", { groups: groups({ tab1: { chord: "F8", problem: { kind: "collision", detail: "F8 is already Hold-to-talk. Pick another key or clear that one first." } } }) });
export const A_List_SystemWarning = story("list", { groups: groups({ hold: { chord: "cmd+space", problem: { kind: "system", detail: "⌘ Space opens Spotlight on most Macs. It will work here only if you changed that in System Settings." } } }) });

// --- Layout B: cards (one card per group, two per row when wide)
export const B_Cards = story("cards", {});
export const B_Cards_Locked = story("cards", { permission: "missing" });
export const B_Cards_Capturing = story("cards", { capturing: "tab2" });

// --- Layout C: table (dense, dividers instead of cards)
export const C_Table = story("table", {});
export const C_Table_Locked = story("table", { permission: "missing" });
export const C_Table_Collision = story("table", { groups: groups({ tab1: { chord: "F8", problem: { kind: "collision", detail: "F8 is already Hold-to-talk. Pick another key or clear that one first." } } }) });
