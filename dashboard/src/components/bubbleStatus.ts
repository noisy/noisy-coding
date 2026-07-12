/** Map raw daemon utterance statuses onto HUD status chips. */

export type StatusKind = "done" | "work" | "rec" | "spoken" | "fail" | "off";

export interface StatusChip {
  kind: StatusKind;
  label: string;
}

export function statusChip(status: string): StatusChip {
  const s = status.toLowerCase();
  if (s.includes("cancelled")) return { kind: "off", label: "✕ CANCELLED" };
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
  // Transcribed, sitting in the queue until Claude is free to pick it up.
  // Name WHO we're waiting for: "transmitting" reads like a transfer in
  // trouble when Claude is just busy, and "ready" begs ready-for-what.
  if (s.includes("ready")) return { kind: "work", label: "◌ AWAITING CLAUDE" };
  return { kind: "work", label: status.toUpperCase() };
}

export function formatCost(costUsd: number): string {
  return costUsd > 0 ? `$${costUsd.toFixed(4)}` : "—";
}

/** Recover speakable text from a Claude card („text” — or the legacy
 * "[voice] „text”" format from before voice tags were dropped). */
export function replaySpeechText(cardText: string): string {
  const match = cardText.match(/^(?:\[[^\]]+\]\s*)?[„"]?([\s\S]*?)[”"]?$/);
  return (match ? match[1] : cardText).trim();
}

export function formatTime(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
