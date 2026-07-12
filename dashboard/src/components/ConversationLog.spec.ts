import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { Utterance } from "../types";
import ConversationLog from "./ConversationLog.vue";

function utterance(id: number, role: "user" | "claude"): Utterance {
  return {
    id,
    role,
    status: "played",
    text: `utterance ${id}`,
    detail: "",
    cost_usd: 0,
    agent: null,
    started_at: 0,
    updated_at: 0,
  };
}

describe("ConversationLog", () => {
  it("renders oldest first so the newest message is at the bottom", () => {
    const wrapper = mount(ConversationLog, {
      props: { utterances: [utterance(3, "user"), utterance(1, "claude"), utterance(2, "user")] },
    });

    const texts = wrapper.findAll(".txt").map((n) => n.text());
    expect(texts).toEqual(["utterance 1", "utterance 2", "utterance 3"]);
  });

  it("picks the bubble flavor from the role", () => {
    const wrapper = mount(ConversationLog, {
      props: { utterances: [utterance(1, "claude"), utterance(2, "user")] },
    });

    const bubbles = wrapper.findAll(".msg");
    expect(bubbles[0].classes()).toContain("claude");
    expect(bubbles[1].classes()).toContain("you");
  });

  it("shows an empty-state line without utterances", () => {
    const wrapper = mount(ConversationLog, { props: { utterances: [] } });

    expect(wrapper.find(".empty").exists()).toBe(true);
  });
});
