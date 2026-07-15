/** Pure detection of conversation events worth an audio cue.

The composable feeds consecutive utterance snapshots through detectCues;
this module only decides WHAT happened — playing sounds is elsewhere. */

import type { Utterance } from "../types";

export type CueName =
  | "committed" // the user's utterance left the composer (transcribed)
  | "delivered" // it reached Claude
  | "claude" // a new Claude message arrived
  | "unheard" // ...while Claude's voice is muted (parked silently)
  | "error"; // an *_error event surfaced

type Snapshot = Map<number, { role: string; status: string }>;

export function snapshotUtterances(utterances: Utterance[]): Snapshot {
  return new Map(utterances.map((u) => [u.id, { role: u.role, status: u.status }]));
}

function isLive(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("recording") || s.includes("transcribing");
}

export function detectCues(
  previous: Snapshot,
  utterances: Utterance[],
  voiceMuted: boolean,
): CueName[] {
  // A complete id swap is a VIEW change (agent tab switched), not events:
  // every claude card of the other conversation would read as "new" and
  // its whole history would blast N overlapping blips at once.
  const swapped =
    previous.size > 0 && utterances.length > 0 && utterances.every((u) => !previous.has(u.id));
  if (swapped) return [];
  const cues: CueName[] = [];
  for (const u of utterances) {
    const before = previous.get(u.id);
    const status = u.status.toLowerCase();
    if (u.role === "user") {
      if (before && isLive(before.status) && status.includes("ready")) {
        cues.push("committed");
      }
      if (before && !before.status.includes("delivered") && status.includes("delivered")) {
        cues.push("delivered");
      }
    } else if (u.role === "claude" && !before) {
      // Skip history backfill: only cue cards that appear while running.
      if (previous.size > 0) cues.push(voiceMuted ? "unheard" : "claude");
    }
  }
  // One blip per cue kind per tick: a burst of four announces is one
  // arrival, not four overlapping (and therefore loud) ones.
  return [...new Set(cues)];
}
