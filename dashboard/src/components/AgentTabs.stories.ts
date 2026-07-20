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

/** Tabs sitting ON the conversation window — the folder-tab fusion as it
 *  looks in the app: the bright top line passes under inactive tabs and
 *  breaks under the selected one. Replicates App.vue's tabsbar styles
 *  (they are scoped there), so tune them here first, then port back.
 */
export const TabsOnWindow: StoryObj<typeof AgentTabs> = {
  render: () => {
    const agents = {
      release: "release",
      "character-avatars": "character-avatars",
      personal: "personal",
      docs: "docs",
      "old-thread": "old-thread",
    };
    const meta = {
      release: { label: "release", online: true, activated_at: 1, offline_since: null },
      "character-avatars": { label: "character-avatars", online: true, activated_at: 2, offline_since: null },
      personal: { label: "personal", online: true, activated_at: 3, offline_since: null },
      docs: { label: "docs", online: true, activated_at: 4, offline_since: null },
      "old-thread": { label: "old-thread", online: false, activated_at: 0, offline_since: 5 },
    };
    const css = `
      .sbw { background: #02060c; padding: 26px; }
      .sbw .tabswrap { padding: 0 14px; }
      .sbw .tabswrap .tabs { margin-bottom: -1px; gap: 6px; position: relative; z-index: 1; align-items: flex-end; }
      .sbw .tabswrap .tabs button { border-bottom: 1px solid var(--line-strong, rgba(64,200,255,0.55)); padding-top: 8px; padding-bottom: 9px; clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px); }
      .sbw .tabswrap .tabs button.viewing {
        background: linear-gradient(rgba(63,216,255,0.1), rgba(63,216,255,0.02) 60%, #071626);
        border-color: rgba(64,200,255,0.55);
        border-bottom-color: transparent;
        padding-top: 14px;
        margin-bottom: -1px;
        position: relative;
        z-index: 2;
      }
      .sbw .window {
        background: rgba(7, 19, 32, 0.78);
        border: 1px solid rgba(64, 200, 255, 0.22);
        border-top-color: rgba(64, 200, 255, 0.55);
        clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
        padding: 16px;
        min-height: 180px;
        display: flex;
        gap: 16px;
      }
      .sbw .fake-log { flex: 1; display: flex; flex-direction: column; gap: 10px; }
      .sbw .bubble { border: 1px solid rgba(64,200,255,0.22); padding: 10px 12px; font: 10px monospace; color: #8fb2c9; max-width: 70%; }
      .sbw .bubble.user { align-self: flex-end; border-color: rgba(255,180,84,0.3); }
      .sbw .fake-rail { width: 170px; border-left: 1px solid rgba(64,200,255,0.22); padding-left: 14px; font: 9px monospace; color: #5d7f96; letter-spacing: 0.2em; }
    `;
    return () =>
      h("div", { class: "sbw" }, [
        h("style", null, css),
        h("div", { class: "tabswrap" }, [
          h(AgentTabs, {
            agents,
            meta,
            active: "release",
            viewed: "release",
            speaking: ["character-avatars"],
            thinking: ["personal"],
            queued: { docs: 3 },
          }),
        ]),
        h("div", { class: "window" }, [
          h("div", { class: "fake-log" }, [
            h("div", { class: "bubble" }, "voice reply lands here…"),
            h("div", { class: "bubble user" }, "and your speech here"),
            h("div", { class: "bubble" }, "the selected tab fuses with this frame"),
          ]),
          h("div", { class: "fake-rail" }, "AVATAR · CHARACTER · RING"),
        ]),
      ]);
  },
};
