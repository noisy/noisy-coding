/** Big system-state readout logic for StatusStrip. */

import type { DaemonStatus } from "../types";

export interface SystemState {
  label: string;
  detail: string;
  tone: "ok" | "warn" | "off";
}

export function stateLabel(status: DaemonStatus | null, offline: boolean): SystemState {
  if (offline || !status) {
    return { label: "OFFLINE", detail: "DAEMON NOT RESPONDING", tone: "off" };
  }
  if (status.muted) {
    return { label: "MUTED", detail: "MIC IGNORED — MUTED BY YOU", tone: "warn" };
  }
  if (!status.listening) {
    return { label: "SPEAKING", detail: "PLAYBACK ACTIVE · MIC MUTED", tone: "warn" };
  }
  if (status.recording) {
    return { label: "RECORDING", detail: "CAPTURING YOUR UTTERANCE", tone: "ok" };
  }
  return { label: "LISTENING", detail: `VAD ARMED · QUEUE ${status.queued}`, tone: "ok" };
}
