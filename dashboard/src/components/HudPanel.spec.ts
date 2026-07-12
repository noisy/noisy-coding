import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import HudPanel from "./HudPanel.vue";

describe("HudPanel", () => {
  it("renders the index, title and slot content", () => {
    const wrapper = mount(HudPanel, {
      props: { index: "01", title: "MIC INPUT · OSCILLOSCOPE" },
      slots: { default: "<p>panel body</p>" },
    });

    expect(wrapper.find(".ptitle .idx").text()).toBe("01");
    expect(wrapper.find(".ptitle").text()).toContain("MIC INPUT · OSCILLOSCOPE");
    expect(wrapper.find("p").text()).toBe("panel body");
  });
});
