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

  it("drops the speech quote when the spoken card is on screen", () => {
    const speaking = { text: "SPEAKING · „Zrobione, testy zielone.”", at: 0 };
    const withCard = mount(ActivityLine, {
      props: { activity: speaking, playingCardVisible: true },
    });
    expect(withCard.find(".txt").text()).toBe("CLAUDE IS BUSY — SPEAKING");

    // The full quote stays when the card isn't in this feed (another tab).
    const withoutCard = mount(ActivityLine, { props: { activity: speaking } });
    expect(withoutCard.find(".txt").text()).toContain("Zrobione, testy zielone.");
  });

  it("renders nothing when the agent is idle", () => {
    const wrapper = mount(ActivityLine, { props: { activity: null } });

    expect(wrapper.find(".busyrow").exists()).toBe(false);
  });
});
