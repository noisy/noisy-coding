import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { Character, DaemonStatus } from "../types";
import CharacterReadout from "./CharacterReadout.vue";
import StatusStrip from "./StatusStrip.vue";
import { stateLabel } from "./systemState";

const character: Character = {
  humor: 50,
  honesty: 50,
  brevity: 100,
  chatty: 100,
  voice: "altair",
  speed: 1.1,
};

describe("CharacterReadout", () => {
  it("shows the current voice uppercase and the speed", () => {
    const wrapper = mount(CharacterReadout, { props: { character } });

    expect(wrapper.find(".vname").text()).toBe("ALTAIR");
    expect(wrapper.find(".sv").text()).toBe("1.10×");
  });

  it("draws gauge arcs proportional to trait values", () => {
    const wrapper = mount(CharacterReadout, { props: { character } });

    const gauges = wrapper.findAll(".gauge");
    const arcOf = (gauge: (typeof gauges)[number]) =>
      parseFloat(gauges && gauge.findAll("circle")[1].attributes("stroke-dasharray")!.split(" ")[0]);
    const humorArc = arcOf(gauges[0]); // 50/100
    const brevityArc = arcOf(gauges[2]); // 100/100

    expect(brevityArc).toBeCloseTo(humorArc * 2, 3);
  });
});

function status(overrides: Partial<DaemonStatus>): DaemonStatus {
  return {
    listening: true, muted: false, recording: false, claude_speaking: false,
    speaking_agents: [], queued: 0, session_cost_usd: { user: 0.01, claude: 0.02 },
    credits_usd: 4.5, mode: "live", tts_mode: "live", end_silence_ms: 800,
    smart_turn: 0, smart_turn_mode: "soft", language: "pl", agents: {},
    agent_labels: {}, active_agent: null,
    ...overrides,
  };
}

describe("stateLabel", () => {
  it.each([
    [null, true, "OFFLINE"],
    [status({ muted: true }), false, "MUTED"],
    [status({ listening: false }), false, "SPEAKING"],
    [status({ recording: true }), false, "RECORDING"],
    [status({}), false, "LISTENING"],
  ])("labels %#", (s, offline, expected) => {
    expect(stateLabel(s, offline).label).toBe(expected);
  });
});

describe("StatusStrip", () => {
  it("shows total cost and the credits fuel", () => {
    const wrapper = mount(StatusStrip, { props: { status: status({}), offline: false } });

    expect(wrapper.find(".total").text()).toBe("$0.0300");
    expect(wrapper.find(".fuel .frow b").text()).toBe("$4.50");
    expect(wrapper.findAll(".fuelbar i.off").length).toBe(2); // 4.5/5 → 18 of 20 on
  });
});
