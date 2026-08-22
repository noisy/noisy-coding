/** #33: switching agent tabs must be silent — a view change is the user
 * navigating, not conversation events. */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { DaemonStatus, Utterance } from "../types";
import { useAudioCues } from "./useAudioCues";

vi.mock("./cueSounds", () => ({
  playCue: vi.fn(),
  startRecordingHum: vi.fn(),
  stopRecordingHum: vi.fn(),
  HUM_DEFAULT_VOLUME: 0.25,
}));
import { playCue } from "./cueSounds";

function utterance(id: number, role: string): Utterance {
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
  } as Utterance;
}

describe("useAudioCues on tab switch", () => {
  beforeEach(() => {
    vi.mocked(playCue).mockClear();
    localStorage.clear();
  });

  it("stays silent when the viewed agent changes, even with shared cards", async () => {
    const utterances = ref<Utterance[]>([utterance(1, "claude")]);
    const status = ref<DaemonStatus | null>(null);
    const viewedAgent = ref<string | null>("alpha");
    useAudioCues(utterances, status, ref(0), viewedAgent);

    // Tab switch to a view that SHARES card 1 (broadcast announce) and
    // adds an unseen claude card — the id-swap fallback alone would blip.
    viewedAgent.value = "beta";
    utterances.value = [utterance(1, "claude"), utterance(2, "claude")];
    await nextTick();
    expect(playCue).not.toHaveBeenCalled();
  });

  it("still cues a genuinely new claude card within one view", async () => {
    const utterances = ref<Utterance[]>([utterance(1, "claude")]);
    const status = ref<DaemonStatus | null>(null);
    const viewedAgent = ref<string | null>("alpha");
    const { prefs } = useAudioCues(utterances, status, ref(0), viewedAgent);
    prefs.value.cues.claude = true; // defaults OFF now - opt in for the test

    // Prime the baseline: the watcher only sees mutations, and the very
    // first snapshot is treated as history backfill (never cued).
    utterances.value = [utterance(1, "claude")];
    await nextTick();

    utterances.value = [utterance(1, "claude"), utterance(2, "claude")];
    await nextTick();
    expect(playCue).toHaveBeenCalledWith("claude");
  });

  it("stays silent through the in-flight-poll race (#33 third life)", async () => {
    // Sequence: user clicks a tab; a poll STARTED for the old tab lands
    // first (list unchanged, marker still old agent), THEN the next poll
    // delivers the new tab's list together with the new marker. Neither
    // step may cue - keying on viewedAgent (which flips instantly) did.
    const utterances = ref<Utterance[]>([utterance(1, "claude")]);
    const status = ref<DaemonStatus | null>(null);
    const utterancesFor = ref<string | null>("alpha");
    useAudioCues(utterances, status, ref(0), utterancesFor);

    utterances.value = [utterance(1, "claude")]; // prime baseline (alpha)
    await nextTick();

    // late old-tab poll: same list, marker still alpha
    utterances.value = [utterance(1, "claude")];
    await nextTick();

    // next poll: beta's list + marker, atomically
    utterancesFor.value = "beta";
    utterances.value = [utterance(7, "claude"), utterance(8, "claude")];
    await nextTick();
    expect(playCue).not.toHaveBeenCalled();
  });
});
