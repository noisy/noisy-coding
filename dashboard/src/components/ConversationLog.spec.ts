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

  it("renders the in-progress utterance in the reserved live slot", () => {
    const recording = { ...utterance(3, "user"), status: "recording…" };
    const wrapper = mount(ConversationLog, {
      props: { utterances: [utterance(1, "user"), utterance(2, "claude"), recording] },
    });

    expect(wrapper.find(".liveslot .msg").exists()).toBe(true);
    expect(wrapper.findAll(".feed .msg")).toHaveLength(2);
  });

  it("keeps the live slot reserved (present) when nothing is in progress", () => {
    const wrapper = mount(ConversationLog, {
      props: { utterances: [utterance(1, "user")] },
    });

    expect(wrapper.find(".liveslot").exists()).toBe(true);
    expect(wrapper.find(".liveslot .msg").exists()).toBe(false);
  });

  it("hides never-became-speech noise but keeps STT errors", () => {
    const noise = { ...utterance(1, "user"), status: "empty — no speech" };
    const tooShort = { ...utterance(2, "user"), status: "dropped — too short" };
    const sttError = { ...utterance(3, "user"), status: "transcription error" };

    const wrapper = mount(ConversationLog, {
      props: { utterances: [noise, tooShort, sttError, utterance(4, "claude")] },
    });

    expect(wrapper.findAll(".msg")).toHaveLength(2);
    expect(wrapper.text()).toContain("utterance 3");
  });
});
