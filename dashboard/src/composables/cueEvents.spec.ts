import { describe, expect, it } from "vitest";
import type { Utterance } from "../types";
import { detectCues, snapshotUtterances } from "./cueEvents";

function utterance(id: number, role: "user" | "claude", status: string): Utterance {
  return {
    id, role, status, text: "x", detail: "", cost_usd: 0, agent: null,
    started_at: 0, updated_at: 0, committed_at: 0,
  };
}

describe("detectCues", () => {
  it("cues commitment and delivery as the user's message advances", () => {
    const recording = [utterance(1, "user", "transcribing (live)…")];
    const ready = [utterance(1, "user", "ready — awaiting pickup")];
    const delivered = [utterance(1, "user", "delivered to Claude")];

    expect(detectCues(snapshotUtterances(recording), ready, false)).toEqual(["committed"]);
    expect(detectCues(snapshotUtterances(ready), delivered, false)).toEqual(["delivered"]);
  });

  it("cues a new claude card — as unheard when the voice is muted", () => {
    const before = snapshotUtterances([utterance(1, "user", "delivered to Claude")]);
    const withReply = [
      utterance(1, "user", "delivered to Claude"),
      utterance(2, "claude", "queued"),
    ];

    expect(detectCues(before, withReply, false)).toEqual(["claude"]);
    expect(detectCues(before, withReply, true)).toEqual(["unheard"]);
  });

  it("stays silent for history backfill and unchanged snapshots", () => {
    const history = [utterance(1, "claude", "played"), utterance(2, "user", "delivered to Claude")];

    expect(detectCues(snapshotUtterances([]), history, false)).toEqual([]);
    expect(detectCues(snapshotUtterances(history), history, false)).toEqual([]);
  });

  it("stays silent when the whole list swaps — that's an agent tab switch", () => {
    // Every card of the other agent's history is "new" to the snapshot;
    // cueing them all would stack N blips into one very loud blast.
    const mine = snapshotUtterances([utterance(1, "claude", "played")]);
    const theirs = [
      utterance(10, "claude", "played"),
      utterance(11, "claude", "played"),
      utterance(12, "user", "delivered to Claude"),
    ];

    expect(detectCues(mine, theirs, false)).toEqual([]);
  });

  it("plays each cue kind once per tick, even for a burst of new cards", () => {
    const before = snapshotUtterances([utterance(1, "user", "delivered to Claude")]);
    const burst = [
      utterance(1, "user", "delivered to Claude"),
      utterance(2, "claude", "queued"),
      utterance(3, "claude", "queued"),
      utterance(4, "claude", "queued"),
    ];

    expect(detectCues(before, burst, false)).toEqual(["claude"]);
  });
});
