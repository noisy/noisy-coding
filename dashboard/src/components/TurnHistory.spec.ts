import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { Utterance } from "../types";
import TurnHistory from "./TurnHistory.vue";

function utterance(id: number, role: "user" | "claude", committed: number, duration = 5): Utterance {
  return { id, role, status: "played", text: "A spoken turn", detail: "", cost_usd: 0,
    agent: null, started_at: committed - duration, updated_at: committed,
    committed_at: committed, duration_s: duration };
}

describe("TurnHistory", () => {
  it("summarizes both speakers and elapsed conversation time", () => {
    const wrapper = mount(TurnHistory, { props: { utterances: [
      utterance(1, "user", 100), utterance(2, "claude", 110), utterance(3, "user", 190),
    ] } });
    expect(wrapper.get(".total").text()).toBe("3 turns");
    expect(wrapper.get(".elapsed").text()).toBe("1m 30s elapsed");
    expect(wrapper.findAll(".counts > div").map(row => row.text())).toEqual(["You2", "Agent1"]);
  });

  it("excludes unfinished speech and system events", () => {
    const wrapper = mount(TurnHistory, { props: { utterances: [
      utterance(1, "user", 100), utterance(2, "user", 0),
      { ...utterance(3, "claude", 120), role: "system" },
    ] } });
    expect(wrapper.get(".total").text()).toBe("1 turn");
  });

  it("preserves chronological duration proportions without reordering the source", () => {
    const source = [utterance(2, "claude", 120, 15), utterance(1, "user", 100, 5)];
    const wrapper = mount(TurnHistory, { props: { utterances: source } });
    expect(wrapper.findAll("rect").map(rect => [rect.attributes("x"), rect.attributes("width")])).toEqual([["0", "25"], ["25", "75"]]);
    expect(source.map(turn => turn.id)).toEqual([2, 1]);
  });

  it("shows a clear empty state", () => {
    const wrapper = mount(TurnHistory, { props: { utterances: [] } });
    expect(wrapper.get(".total").text()).toBe("0 turns");
    expect(wrapper.get(".empty").text()).toBe("Your turns will appear here.");
    expect(wrapper.find(".elapsed").exists()).toBe(false);
  });
});
