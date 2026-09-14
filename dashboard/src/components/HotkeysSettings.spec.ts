import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HotkeysSettings from "./HotkeysSettings.vue";

const pane = (title: string, action: string) => ({ title, bindings: [{ action, label: action, chord: "F8" }] });

describe("HotkeysSettings locked state", () => {
  it("keeps the GRANT banner clickable while the bindings are disabled", async () => {
    const w = mount(HotkeysSettings, {
      props: { permission: "missing", talk: pane("Push to talk", "hold"), tabs: pane("…to a specific tab", "tab1") },
    });
    // The root must not carry the dashboard's global .locked class (it
    // dims and blocks pointer events on the whole element).
    expect(w.find(".hotkeys").classes()).not.toContain("locked");
    expect(w.find(".hotkeys").classes()).toContain("perm-locked");
    expect(w.find("fieldset").attributes("disabled")).toBeDefined();
    await w.find(".gate button").trigger("click");
    expect(w.emitted("grant")).toHaveLength(1);
  });
});
