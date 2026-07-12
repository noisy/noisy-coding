import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { Utterance } from "../types";
import Bubble from "./Bubble.vue";
import { formatCost, statusChip } from "./bubbleStatus";
import UserBubble from "./UserBubble.vue";

describe("statusChip", () => {
  it.each([
    ["recording…", "rec", "● RECORDING"],
    ["playing through speakers…", "spoken", "▶ PLAYING"],
    ["queued — waiting for you to finish", "work", "◌ HOLDING"],
    ["queued", "work", "◌ QUEUED"],
    ["synthesizing (Grok TTS)…", "work", "◌ SYNTHESIZING"],
    ["transcribing (live)…", "work", "◌ TRANSCRIBING"],
    ["delivered to Claude", "done", "✓ DELIVERED"],
    ["played", "done", "✓ PLAYED"],
    ["ready — awaiting pickup", "done", "✓ READY"],
    ["transcription error", "fail", "✕ ERROR"],
    ["dropped — too short", "fail", "✕ DROPPED"],
  ])("maps %s → %s", (status, kind, label) => {
    expect(statusChip(status)).toEqual({ kind, label });
  });
});

describe("formatCost", () => {
  it("renders dollars with 4 decimals and em-dash for zero", () => {
    expect(formatCost(0.00412)).toBe("$0.0041");
    expect(formatCost(0)).toBe("—");
  });
});

describe("Bubble", () => {
  it("renders who, text, status label and cost", () => {
    const wrapper = mount(Bubble, {
      props: {
        side: "left" as const,
        accent: "violet" as const,
        who: "CLAUDE",
        text: "Done. Staging is live.",
        statusKind: "done" as const,
        statusLabel: "✓ PLAYED",
        time: "21:46:38",
        cost: "$0.0041",
      },
    });

    expect(wrapper.find(".who").text()).toBe("CLAUDE");
    expect(wrapper.find(".txt").text()).toContain("Done. Staging is live.");
    expect(wrapper.find(".st").text()).toBe("✓ PLAYED");
    expect(wrapper.find(".cost").text()).toBe("$0.0041");
    expect(wrapper.find(".livebars").exists()).toBe(false);
  });
});

describe("UserBubble", () => {
  const utterance: Utterance = {
    id: 7,
    role: "user",
    status: "recording…",
    text: "No dobra, to teraz",
    detail: "",
    cost_usd: 0,
    agent: null,
    started_at: 1_783_890_000,
    updated_at: 1_783_890_003,
  };

  it("maps a recording utterance to a live amber bubble on the right", () => {
    const wrapper = mount(UserBubble, { props: { utterance } });

    expect(wrapper.find(".msg").classes()).toContain("you");
    expect(wrapper.find(".msg").classes()).toContain("accent-amber");
    expect(wrapper.find(".st").classes()).toContain("rec");
    expect(wrapper.find(".livebars").exists()).toBe(true);
  });
});
