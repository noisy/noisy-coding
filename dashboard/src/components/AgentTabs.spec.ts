import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentTabs from "./AgentTabs.vue";

const agents = { "id-a": "grok-voice-stabilization", "id-b": "personal" };

describe("AgentTabs", () => {
  it("renders a labeled tab per agent", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents, active: "id-a", viewed: "id-a", speaking: [] },
    });

    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels).toEqual(["grok-voice-stabilization", "personal"]);
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

  it("renders nothing without agents", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents: {}, active: null, viewed: null, speaking: [] },
    });

    expect(wrapper.find("nav").exists()).toBe(false);
  });
});
