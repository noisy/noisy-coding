import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ActivityLine from "./ActivityLine.vue";

describe("ActivityLine", () => {
  it("shows the current tool line with a live age", () => {
    const wrapper = mount(ActivityLine, {
      props: { activity: { text: "Edit · App.vue", at: Date.now() / 1000 - 3 } },
    });

    expect(wrapper.find(".txt").text()).toBe("CLAUDE IS BUSY — Edit · App.vue");
    expect(wrapper.find(".age").text()).toMatch(/^\d+s$/);
  });

  it("renders nothing when the agent is idle", () => {
    const wrapper = mount(ActivityLine, { props: { activity: null } });

    expect(wrapper.find(".busyrow").exists()).toBe(false);
  });
});
