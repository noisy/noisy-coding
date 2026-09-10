import { expect, it } from "vitest";
import { recordedCrewAt, type RecordedTake } from "./recordedCrewTimeline";

const take: RecordedTake = {
  transcriptOffsetsMs: {},
  events: [
    { sequence: 0, type: "user-start", utterance: "u1", voice: "Lux", atMs: 0 },
    { sequence: 1, type: "transcript", utterance: "u1", text: "How", atMs: 600 },
    { sequence: 2, type: "user-end", utterance: "u1", atMs: 1000 },
    { sequence: 3, type: "agent-start", voice: "Lux", text: "Green!", atMs: 1100 },
    { sequence: 4, type: "transcript", utterance: "u1", text: "How is staging?", atMs: 1400 },
    { sequence: 5, type: "agent-end", atMs: 2000 },
    { sequence: 6, type: "camera-zoom", atMs: 2200 },
    { sequence: 7, type: "agent-switch", voice: "Rex", atMs: 3000 },
    { sequence: 8, type: "agent-start", voice: "Rex", text: "Approved!", atMs: 3100 },
    { sequence: 9, type: "camera-reset", atMs: 4000 },
  ],
};
it("shows recorded partials and applies late final text to the original bubble", () => {
  expect(recordedCrewAt(take, 800).liveText).toBe("How");
  expect(recordedCrewAt(take, 1500).feed).toEqual([
    { id: "u1", role: "user", text: "How is staging?", zone: "done" },
    { id: "agent-3", role: "claude", text: "Green!", zone: "done" },
  ]);
});
it("offsets only transcript presentation while leaving agent and camera timing fixed", () => {
  const shifted = { ...take, transcriptOffsetsMs: { u1: -500 } };
  expect(recordedCrewAt(shifted, 200).liveText).toBe("How");
  for (const time of [800, 1200, 2500, 3200, 4100]) {
    const { voice, mode, zoom, agents } = recordedCrewAt(take, time);
    expect(recordedCrewAt(shifted, time)).toMatchObject({ voice, mode, zoom, agents });
  }
});
it("seeks directly across handovers and back without retaining another conversation", () => {
  expect(recordedCrewAt(take, 3200)).toMatchObject({ voice: "rex", zoom: true, feed: [
    { id: "agent-8", role: "claude", text: "Approved!", zone: "done" },
  ] });
  expect(recordedCrewAt(take, 200)).toMatchObject({ voice: "lux", zoom: false, feed: [], mode: "user" });
});
it("keeps the outgoing conversation until the incoming reply is available", () => {
  expect(recordedCrewAt(take, 3050)).toMatchObject({ voice: "lux", feed: [
    { id: "u1", role: "user", text: "How is staging?", zone: "done" },
    { id: "agent-3", role: "claude", text: "Green!", zone: "done" },
  ] });
  expect(recordedCrewAt(take, 3100)).toMatchObject({ voice: "rex", mode: "claude", feed: [
    { id: "agent-8", role: "claude", text: "Approved!", zone: "done" },
  ] });
});
