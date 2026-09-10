import type { CompanionAgent, CompanionMessage } from "../Companion.vue";

export interface RecordedEvent {
  sequence: number;
  atMs: number;
  type: string;
  utterance?: string;
  voice?: string;
  text?: string;
  clip?: string;
}
export interface RecordedTake {
  events: RecordedEvent[];
  transcriptOffsetsMs: Record<string, number>;
}
const CREW = [
  { name: "orderflow-api", voice: "lux" },
  { name: "pull-requests", voice: "rex" },
  { name: "assistant", voice: "luna" },
];

/** Derive the scene from media time, so seeking, buffering and replay cannot
 * leave any timer-driven message or handover running ahead of the recording. */
export function recordedCrewAt(take: RecordedTake, timeMs: number) {
  const past = take.events.filter(event => event.atMs <= timeMs);
  const starts = take.events.filter(event => event.type === "user-start");
  const transcripts = new Map<string, string>();
  for (const event of take.events) {
    if (event.type !== "transcript" || !event.utterance) continue;
    const start = starts.find(start => start.utterance === event.utterance)?.atMs ?? 0;
    const displayAt = Math.max(start, event.atMs + (take.transcriptOffsetsMs[event.utterance] ?? 0));
    if (displayAt <= timeMs) transcripts.set(event.utterance, event.text ?? "");
  }
  let voice = "lux";
  let user: string | undefined;
  let speaking = false;
  let zoom = false;
  for (const event of past) {
    // The recorder logs the switch just before the reply. Apply both at
    // agent-start so no empty conversation flashes between those events.
    if (["user-start", "agent-start"].includes(event.type)) voice = event.voice!.toLowerCase();
    if (event.type === "user-start") user = event.utterance;
    if (event.type === "user-end") user = undefined;
    if (event.type === "agent-start") speaking = true;
    if (event.type === "agent-end") speaking = false;
    if (event.type === "camera-zoom") zoom = true;
    if (event.type === "camera-reset") zoom = false;
  }
  const feed: CompanionMessage[] = [];
  for (const event of past) {
    if (event.voice?.toLowerCase() !== voice) continue;
    if (event.type === "user-start" && event.utterance !== user) {
      const text = transcripts.get(event.utterance!);
      if (text) feed.push({ id: event.utterance, role: "user", text, zone: "done" });
    }
    if (event.type === "agent-start") feed.push({ id: `agent-${event.sequence}`, role: "claude", text: event.text!, zone: "done" });
  }
  // Preserve the original scenario's waiting-agent affordance independently
  // of transcript corrections; each badge clears on the recorded handover.
  const waitingStarted = past.some(event => event.type === "user-start" && event.utterance === "u2");
  const agents: CompanionAgent[] = CREW.map(agent => {
    const hasSpoken = past.some(event => event.type === "agent-start" && event.voice?.toLowerCase() === agent.voice);
    const waiting = waitingStarted && agent.voice !== "lux" && !hasSpoken ? 1 : 0;
    return { ...agent, active: agent.voice === voice, waiting, unread: waiting > 0 };
  });
  return {
    voice, feed, agents, zoom,
    liveText: user ? transcripts.get(user) ?? "" : "",
    mode: (user ? "user" : speaking ? "claude" : "idle") as "user" | "claude" | "idle",
  };
}
