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

  it("groups actives first (arrival order), then offline (most recently ended first)", () => {
    const wrapper = mount(AgentTabs, {
      props: {
        agents: { old: "old", young: "young", dead1: "dead1", dead2: "dead2" },
        meta: {
          young: { label: "young", online: true, activated_at: 200, offline_since: null },
          old: { label: "old", online: true, activated_at: 100, offline_since: null },
          dead1: { label: "dead1", online: false, activated_at: 50, offline_since: 500 },
          dead2: { label: "dead2", online: false, activated_at: 60, offline_since: 900 },
        },
        active: "old",
        viewed: "old",
        speaking: [],
      },
    });

    const labels = wrapper.findAll("button").map((b) => b.text().replace("✕", "").trim());
    expect(labels).toEqual(["old", "young", "dead2", "dead1"]);
  });

  it("greys out offline tabs and lets only them be dismissed", async () => {
    const wrapper = mount(AgentTabs, {
      props: {
        agents: { live: "live", gone: "gone" },
        meta: {
          live: { label: "live", online: true, activated_at: 1, offline_since: null },
          gone: { label: "gone", online: false, activated_at: 2, offline_since: 3 },
        },
        active: "live",
        viewed: "live",
        speaking: [],
      },
    });

    const [live, gone] = wrapper.findAll("button");
    expect(live.classes()).not.toContain("offline");
    expect(live.find(".dismiss").exists()).toBe(false);
    expect(gone.classes()).toContain("offline");

    await gone.find(".dismiss").trigger("click");
    expect(wrapper.emitted("dismiss")).toEqual([["gone"]]);
    expect(wrapper.emitted("select")).toBeUndefined(); // ✕ must not also select
  });

  it("treats agents without meta as online (legacy daemon)", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents, active: "id-a", viewed: "id-a", speaking: [] },
    });

    const tabs = wrapper.findAll("button");
    expect(tabs.every((t) => !t.classes().includes("offline"))).toBe(true);
  });
});
