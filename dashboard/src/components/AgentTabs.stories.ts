import type { Meta, StoryObj } from "@storybook/vue3";
import { h } from "vue";
import AgentTabs from "./AgentTabs.vue";

const meta: Meta<typeof AgentTabs> = {
  component: AgentTabs,
  title: "HUD/AgentTabs",
};
export default meta;

/** The canonical tab-state matrix, rendered by the REAL component.
 *
 *  Rows: is this the selected tab (your voice goes here — taller, fused
 *  with the frame) or a background one. Columns: the single status glyph,
 *  option-B priority ladder: MUTE (with or without a waiting count) >
 *  SPEAKING (green equalizer) > WORKING (violet pulse) > WAIT count
 *  (amber) > idle dot. WORK+3 / SPEAK+3 prove the count stays hidden
 *  while the agent is busy; ENDED shows the greyed offline tab.
 */
export const StateMatrix: StoryObj<typeof AgentTabs> = {
  render: () => {
    const COLUMNS = [
      { key: "idle", label: "IDLE" },
      { key: "wait", label: "WAIT 3" },
      { key: "working", label: "WORKING" },
      { key: "work3", label: "WORK + 3" },
      { key: "speaking", label: "SPEAKING" },
      { key: "speak3", label: "SPEAK + 3" },
      { key: "muted", label: "MUTED" },
      { key: "mute3", label: "MUTE + 3" },
      { key: "offline", label: "ENDED" },
    ] as const;
    const ROWS = [
      { key: "sel", label: "SELECTED", selected: true },
      { key: "bg", label: "BACKGROUND", selected: false },
    ] as const;

    const cell = (row: (typeof ROWS)[number], col: (typeof COLUMNS)[number]) => {
      const name = `${row.key}-${col.key}`;
      const label = col.label.toLowerCase().replace(" + 3", "");
      return h(AgentTabs, {
        agents: { [name]: label },
        meta: {
          [name]: {
            label,
            online: col.key !== "offline",
            activated_at: 1,
            offline_since: col.key === "offline" ? 100 : null,
          },
        },
        active: row.selected ? name : null,
        viewed: row.selected ? name : null,
        speaking: col.key.startsWith("speak") ? [name] : [],
        thinking: col.key.startsWith("work") ? [name] : [],
        muted: col.key.startsWith("mute") ? [name] : [],
        queued: ["wait", "work3", "speak3", "mute3"].includes(col.key) ? { [name]: 3 } : {},
      });
    };

    const head =
      "font: 700 9px monospace; letter-spacing: 0.18em; color: #5d7f96; padding: 4px;";
    return () =>
      h(
        "div",
        {
          style:
            "display: grid; grid-template-columns: 100px repeat(9, auto); gap: 10px 12px; align-items: end; background: #04101a; padding: 20px; justify-content: start;",
        },
        [
          h("div"),
          ...COLUMNS.map((c) => h("div", { style: head }, c.label)),
          ...ROWS.flatMap((row) => [
            h("div", { style: head }, row.label),
            ...COLUMNS.map((col) => h("div", cell(row, col))),
          ]),
        ],
      );
  },
};
