import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { Character, DaemonStatus } from "../types";
import { speedFromAngle, traitValueFromAngle } from "./characterMath";
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

describe("characterMath", () => {
  it("maps gauge angles across the 280° sweep to 0-100", () => {
    expect(traitValueFromAngle(130)).toBe(0); // arc start
    expect(traitValueFromAngle(270)).toBe(50); // halfway
    expect(traitValueFromAngle(50)).toBe(100); // arc end (130+280 mod 360)
  });

  it("snaps dead-zone angles to the nearest arc end", () => {
    expect(traitValueFromAngle(60)).toBe(100);
    expect(traitValueFromAngle(120)).toBe(0);
  });

  it("maps speed dial angles into the 0.7-1.5 range in 0.05 steps", () => {
    expect(speedFromAngle(145)).toBe(0.7);
    expect(speedFromAngle(270)).toBe(1.1);
    expect(speedFromAngle(35)).toBe(1.5);
  });
});

describe("CharacterReadout editing", () => {
  it("picking a voice from the grid emits a change patch", async () => {
    const wrapper = mount(CharacterReadout, { props: { character } });

    await wrapper.find(".voicecur").trigger("click");
    const rex = wrapper.findAll(".voicegrid b").find((b) => b.text() === "REX")!;
    await rex.trigger("click");

    expect(wrapper.emitted("change")).toEqual([[{ voice: "rex" }]]);
    expect(wrapper.find(".voicegrid").exists()).toBe(false); // grid closes
  });
});

function status(overrides: Partial<DaemonStatus>): DaemonStatus {
  return {
    listening: true, muted: false, voice_muted: false, recording: false,
    claude_speaking: false, playing_utterance_id: 0,
    api_key_set: true, api_key_hint: "····1234",
    stt_latency_ms: null, tts_latency_ms: null, input_device: "", activity: {},
    speaking_agents: [], queued: 0, session_cost_usd: { user: 0.01, claude: 0.02 },
    usage: { stt_seconds: 0, tts_chars: 0 },
    credits_usd: 4.5, mode: "live", tts_mode: "live", end_silence_ms: 800,
    smart_turn: 0, smart_turn_mode: "soft", detection_mode: "auto", ptt_held: false,
    language: "pl", agents: {}, agent_labels: {}, active_agent: null,
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
