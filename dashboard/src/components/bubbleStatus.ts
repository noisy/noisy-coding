/** Map raw daemon utterance statuses onto HUD status chips. */

export type StatusKind = "done" | "work" | "rec" | "spoken" | "fail";

export interface StatusChip {
  kind: StatusKind;
  label: string;
}

export function statusChip(status: string): StatusChip {
  const s = status.toLowerCase();
  if (s.includes("recording")) return { kind: "rec", label: "● RECORDING" };
  if (s.includes("playing")) return { kind: "spoken", label: "▶ PLAYING" };
  if (s.includes("error")) return { kind: "fail", label: "✕ ERROR" };
  if (s.includes("dropped")) return { kind: "fail", label: "✕ DROPPED" };
  if (s.includes("empty")) return { kind: "fail", label: "✕ NO SPEECH" };
  if (s.includes("waiting for you")) return { kind: "work", label: "◌ HOLDING" };
  if (s.includes("queued")) return { kind: "work", label: "◌ QUEUED" };
  if (s.includes("synthesizing")) return { kind: "work", label: "◌ SYNTHESIZING" };
  if (s.includes("transcribing")) return { kind: "work", label: "◌ TRANSCRIBING" };
  if (s.includes("delivered")) return { kind: "done", label: "✓ DELIVERED" };
  if (s.includes("played")) return { kind: "done", label: "✓ PLAYED" };
  // Transcribed, sitting in the queue until Claude's hook picks it up:
  // mid-pipeline, so a cyan "work" chip, and a label that says where it's
  // headed instead of an ambiguous READY.
  if (s.includes("ready")) return { kind: "work", label: "◌ TRANSMITTING" };
  return { kind: "work", label: status.toUpperCase() };
}

export function formatCost(costUsd: number): string {
  return costUsd > 0 ? `$${costUsd.toFixed(4)}` : "—";
}

export function formatTime(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
