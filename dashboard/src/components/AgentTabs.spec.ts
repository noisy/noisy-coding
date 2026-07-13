import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentTabs from "./AgentTabs.vue";

const agents = { "id-a": "noisy-coding-stabilization", "id-b": "personal" };

describe("AgentTabs", () => {
  it("renders a labeled tab per agent", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents, active: "id-a", viewed: "id-a", speaking: [] },
    });

    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels).toEqual(["noisy-coding-stabilization", "personal"]);
  });

  it("emits select with the agent id on click", async () => {
    const wrapper = mount(AgentTabs, {
      props: { agents, active: "id-a", viewed: "id-a", speaking: [] },
    });

    await wrapper.findAll("button")[1].trigger("click");

    expect(wrapper.emitted("select")).toEqual([["id-b"]]);
  });

  it("marks live, viewing and speaking states", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents, active: "id-b", viewed: "id-a", speaking: ["id-b"] },
    });

    const [a, b] = wrapper.findAll("button");
    expect(a.classes()).toContain("viewing");
    expect(b.classes()).toContain("live");
    expect(b.find(".spk").exists()).toBe(true);
  });

  it("shows an unread dot only on background tabs with activity", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents, active: "id-a", viewed: "id-a", speaking: [], unread: ["id-a", "id-b"] },
    });

    const [a, b] = wrapper.findAll("button");
    expect(a.find(".unread").exists()).toBe(false); // viewed tab never nags
    expect(b.find(".unread").exists()).toBe(true);
  });

  it("renders nothing without agents", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents: {}, active: null, viewed: null, speaking: [] },
    });

    expect(wrapper.find("nav").exists()).toBe(false);
  });
});
