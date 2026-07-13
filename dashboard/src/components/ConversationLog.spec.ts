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
    committed_at: 0,
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
    expect(bubbles[0].classes()).toContain("accent-violet");
    expect(bubbles[1].classes()).toContain("accent-amber");
  });

  it("renders system rows as inline annotations, not bubbles", () => {
    const mic = {
      ...utterance(2, "user"), role: "system" as const,
      text: "MIC → Jabra Link 380", committed_at: 50,
    };
    const wrapper = mount(ConversationLog, {
      props: { utterances: [utterance(1, "user"), mic] },
    });

    expect(wrapper.find(".sysrow").text()).toContain("MIC → Jabra Link 380");
    expect(wrapper.findAll(".msg")).toHaveLength(1);
  });

  it("shows an empty-state line without utterances", () => {
    const wrapper = mount(ConversationLog, { props: { utterances: [] } });

    expect(wrapper.find(".empty").exists()).toBe(true);
  });

  it("orders by commit time — a reply that arrived mid-composition sits above", () => {
    // User started composing at t=10 (lower id would win an id-sort),
    // Claude's reply arrived at t=20, the user finished at t=30.
    const users = { ...utterance(1, "user"), started_at: 10, committed_at: 30 };
    const claudes = { ...utterance(2, "claude"), started_at: 20, committed_at: 20 };

    const wrapper = mount(ConversationLog, { props: { utterances: [users, claudes] } });

    const texts = wrapper.findAll(".txt").map((n) => n.text());
    expect(texts).toEqual(["utterance 2", "utterance 1"]);
  });

  it("keeps the composition in the slot even when a reply arrives after it", () => {
    // User started composing at t=10; Claude's reply landed at t=20 and
    // sorts after it — the reply must join the feed, not push the
    // composition out of the slot.
    const composing = { ...utterance(1, "user"), status: "recording…", started_at: 10, committed_at: 0 };
    const reply = { ...utterance(2, "claude"), started_at: 20, committed_at: 20 };

    const wrapper = mount(ConversationLog, { props: { utterances: [composing, reply] } });

    expect(wrapper.find(".liveslot .msg").exists()).toBe(true);
    expect(wrapper.findAll(".feed .msg")).toHaveLength(1);
    expect(wrapper.find(".feed .txt").text()).toBe("utterance 2");
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

  it("hides never-became-speech noise and cancellations, keeps STT errors", () => {
    const noise = { ...utterance(1, "user"), status: "empty — no speech" };
    const tooShort = { ...utterance(2, "user"), status: "dropped — too short" };
    const sttError = { ...utterance(3, "user"), status: "transcription error" };
    const cancelled = { ...utterance(5, "user"), status: "cancelled by you" };

    const wrapper = mount(ConversationLog, {
      props: { utterances: [noise, tooShort, sttError, cancelled, utterance(4, "claude")] },
    });

    expect(wrapper.findAll(".msg")).toHaveLength(2);
    expect(wrapper.text()).toContain("utterance 3");
  });

  it("marks the bubble whose playback is on the speakers", () => {
    const wrapper = mount(ConversationLog, {
      props: { utterances: [utterance(1, "claude"), utterance(2, "claude")], playingId: 2 },
    });

    const buttons = wrapper.findAll(".replay");
    expect(buttons).toHaveLength(2);
    expect(buttons[1].text()).toBe("⏹");
    expect(buttons[0].text()).not.toBe("⏹");
  });
});
