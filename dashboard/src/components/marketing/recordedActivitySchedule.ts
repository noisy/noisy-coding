import { activityWindows, CONSOLE_ACTIVITIES, presentationTake, type ActivityBlock, type TurnTiming } from './presentationTiming';
import type { RecordedTake } from './recordedCrewTimeline';

export interface ActivityPause { durationMs: number; text: string | null }

/** Replay the homepage's idle intervals relative to each actor/reply boundary.
 * Actor delivery stays free-paced; authored work durations and quiet gaps stay intact. */
export function recordedActivitySchedule(take: RecordedTake, edits: TurnTiming[], blocks: ActivityBlock[]) {
  const events = presentationTake(take, edits).events;
  const windows = activityWindows(take, edits, blocks);
  const beforeReply: Record<string, ActivityPause[]> = {};
  const beforeTurn: Record<string, ActivityPause[]> = {};
  for (const target of events.filter(event => ['user-start', 'agent-start'].includes(event.type))) {
    const previous = events.filter(event => ['user-end', 'agent-end'].includes(event.type) && event.atMs <= target.atMs).at(-1);
    const start = previous?.atMs ?? 0;
    const boundaries = [...new Set([start, target.atMs, ...windows.flatMap(window => [window.startMs, window.endMs]).filter(time => time > start && time < target.atMs)])].sort((a, b) => a - b);
    const pauses = boundaries.slice(1).map((end, index) => {
      const beginning = boundaries[index];
      const window = windows.find(window => beginning >= window.startMs && beginning < window.endMs);
      return { durationMs: end - beginning, text: window ? window.status === 'thinking' ? 'Thinking…' : CONSOLE_ACTIVITIES[window.consoleTask ?? ''] ?? 'Working' : null };
    });
    if (target.type === 'agent-start' && target.clip) beforeReply[target.clip] = pauses;
    if (target.type === 'user-start' && target.utterance) beforeTurn[target.utterance] = pauses;
  }
  return { beforeReply, beforeTurn };
}
