import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { Utterance } from "../types";
import SessionRing from "./SessionRing.vue";

function utterance(id: number, role: "user" | "claude", committed: number, duration = 5): Utterance {
  return {
    id, role, status: "played", text: "x".repeat(60), detail: "", cost_usd: 0,
    agent: null, started_at: committed - duration, updated_at: committed,
    committed_at: committed, duration_s: duration,
  };
}

describe("SessionRing", () => {
  it("draws one arc per committed turn and counts both sides", () => {
    const wrapper = mount(SessionRing, {
      props: {
        utterances: [
          utterance(1, "user", 100),
          utterance(2, "claude", 110),
          utterance(3, "user", 130),
        ],
      },
    });

    expect(wrapper.findAll("path.seg")).toHaveLength(3);
    expect(wrapper.find(".rc1").text()).toBe("3");
    expect(wrapper.text()).toContain("YOU · 2");
    expect(wrapper.text()).toContain("CLAUDE · 1");
  });

  it("skips still-composing utterances (committed_at 0)", () => {
    const composing = { ...utterance(9, "user", 0), committed_at: 0 };
    const wrapper = mount(SessionRing, {
      props: { utterances: [utterance(1, "user", 100), composing] },
    });

    expect(wrapper.findAll("path.seg")).toHaveLength(1);
  });
});
