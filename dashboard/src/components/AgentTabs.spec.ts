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

  it("marks viewing, speaking and thinking states in the fixed status slot", () => {
    const wrapper = mount(AgentTabs, {
      props: {
        agents,
        active: "id-b",
        viewed: "id-a",
        speaking: ["id-b"],
        thinking: ["id-a"],
      },
    });

    const [a, b] = wrapper.findAll("button");
    expect(a.classes()).toContain("viewing");
    expect(b.find(".eq").exists()).toBe(true); // speaking = green equalizer
    expect(a.find(".eq").exists()).toBe(false);
    expect(a.find(".dot.think").exists()).toBe(true); // working = violet pulse
    // The slot always exists, so state changes never resize the tab.
    expect(a.find(".statusslot").exists()).toBe(true);
    expect(b.find(".statusslot").exists()).toBe(true);
  });

  it("waiting count beats working, speaking beats the count", () => {
    const wrapper = mount(AgentTabs, {
      props: {
        agents,
        active: "id-a",
        viewed: "id-a",
        speaking: ["id-b"],
        thinking: ["id-a"],
        queued: { "id-a": 3, "id-b": 5 },
      },
    });

    const [a, b] = wrapper.findAll("button");
    expect(a.find(".waitcount").text()).toBe("3"); // queued outranks working
    expect(a.find(".dot.think").exists()).toBe(false);
    expect(b.find(".waitcount").exists()).toBe(false); // speaking still hides it
    expect(b.find(".eq").exists()).toBe(true);
  });

  it("mute always wins and carries its own dimmed count", () => {
    const wrapper = mount(AgentTabs, {
      props: {
        agents,
        active: "id-a",
        viewed: "id-a",
        speaking: ["id-a", "id-b"],
        muted: ["id-a", "id-b"],
        queued: { "id-b": 7 },
      },
    });

    const [a, b] = wrapper.findAll("button");
    expect(a.find(".mutering").exists()).toBe(true); // muted, empty queue
    expect(a.find(".eq").exists()).toBe(false); // mute beats speaking
    expect(b.find(".mutecount").text()).toBe("7"); // muted with backlog
    expect(b.find(".eq").exists()).toBe(false);
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

  it("puts user-pinned tabs first within their group, in pinned order", () => {
    const wrapper = mount(AgentTabs, {
      props: {
        agents: { a: "a", b: "b", c: "c" },
        meta: {
          a: { label: "a", online: true, activated_at: 1, offline_since: null, manual_pos: null },
          b: { label: "b", online: true, activated_at: 2, offline_since: null, manual_pos: 1 },
          c: { label: "c", online: true, activated_at: 3, offline_since: null, manual_pos: 0 },
        },
        active: "a",
        viewed: "a",
        speaking: [],
      },
    });

    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels).toEqual(["c", "b", "a"]);
  });

  it("emits the group's new order after a drag within the group", async () => {
    const wrapper = mount(AgentTabs, {
      props: {
        agents: { a: "a", b: "b", dead: "dead" },
        meta: {
          a: { label: "a", online: true, activated_at: 1, offline_since: null, manual_pos: null },
          b: { label: "b", online: true, activated_at: 2, offline_since: null, manual_pos: null },
          dead: { label: "dead", online: false, activated_at: 0, offline_since: 9, manual_pos: null },
        },
        active: "a",
        viewed: "a",
        speaking: [],
      },
    });

    const [a, b, dead] = wrapper.findAll("button");
    await a.trigger("dragstart");
    await b.trigger("drop");
    expect(wrapper.emitted("reorder")).toEqual([[["b", "a"]]]);

    // Dropping an active tab onto the offline group is ignored.
    await a.trigger("dragstart");
    await dead.trigger("drop");
    expect(wrapper.emitted("reorder")).toHaveLength(1);
  });

  it("treats agents without meta as online (legacy daemon)", () => {
    const wrapper = mount(AgentTabs, {
      props: { agents, active: "id-a", viewed: "id-a", speaking: [] },
    });

    const tabs = wrapper.findAll("button");
    expect(tabs.every((t) => !t.classes().includes("offline"))).toBe(true);
  });
});
