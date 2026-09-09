import type { RecordedTake } from './recordedCrewTimeline';
export type ActivityKind = 'none' | 'thinking' | 'console';
export interface TurnTiming { utterance: string; userStartMs?: number; userEndMs: number; status: ActivityKind }
export interface ActivityBlock { id: string; startMs: number; endMs: number; status: 'thinking' | 'console'; consoleTask?: string }
export interface PresentationEdits { version: 1; kind: 'demo-presentation-edits'; sourceSha256: string; turns: TurnTiming[]; activities?: ActivityBlock[] }
export const CONSOLE_ACTIVITIES: Record<string, string> = {
  u1: 'Reading src/search.ts', u2: 'Editing src/search.ts', u3: 'Running tests', u4: 'Deploying to production',
};
export function userTurns(take: RecordedTake) {
  return take.events.filter(event => event.type === 'user-start').map(start => {
    const end = take.events.find(event => event.type === 'user-end' && event.utterance === start.utterance)!;
    const nextUser = take.events.find(event => event.type === 'user-start' && event.atMs > start.atMs);
    const replies = take.events.filter(event => event.type === 'agent-start' && event.atMs >= end.atMs && (!nextUser || event.atMs < nextUser.atMs));
    return { utterance: start.utterance!, startMs: start.atMs, endMs: end.atMs, replyMs: replies[0]?.atMs,
      text: take.events.filter(event => event.type === 'transcript' && event.utterance === start.utterance).at(-1)?.text ?? '',
      previewEndMs: nextUser?.atMs ?? end.atMs + 800 };
  });
}
export function validatePresentation(value: unknown, take: RecordedTake, sourceSha256: string): PresentationEdits {
  const document = value as PresentationEdits;
  if (!document || document.version !== 1 || document.kind !== 'demo-presentation-edits' || document.sourceSha256 !== sourceSha256 || !Array.isArray(document.turns)) throw new Error('This timing file does not match the original hero recording.');
  const turns = userTurns(take); const seen = new Set();
  for (const edit of document.turns) {
    const turn = turns.find(turn => turn.utterance === edit.utterance);
    if (!turn || seen.has(edit.utterance) || !Number.isInteger(edit.userEndMs) || edit.userEndMs < turn.startMs || edit.userEndMs > turn.endMs
      || (edit.userStartMs !== undefined && (!Number.isInteger(edit.userStartMs) || edit.userStartMs < turn.startMs || edit.userStartMs >= edit.userEndMs))
      || !['none', 'thinking', 'console'].includes(edit.status) || (edit.status !== 'none' && turn.replyMs === undefined)) {
      throw new Error('End time must stay within its original user turn; work status requires a following reply.');
    }
    seen.add(edit.utterance);
  }
  if (document.activities !== undefined && !Array.isArray(document.activities)) throw new Error('Invalid activity blocks.');
  const windows = activityWindows(take, document.turns, document.activities ?? []).sort((a, b) => a.startMs - b.startMs);
  const gaps = idleWindows(take, document.turns);
  const ids = new Set<string>();
  for (const block of document.activities ?? []) {
    if (!block.id || ids.has(block.id) || !Number.isInteger(block.startMs) || !Number.isInteger(block.endMs)
      || block.startMs >= block.endMs || !['thinking', 'console'].includes(block.status)
      || (block.status === 'console' && !CONSOLE_ACTIVITIES[block.consoleTask ?? ''])
      || !gaps.some(gap => block.startMs >= gap.startMs && block.endMs <= gap.endMs)) {
      throw new Error('Activity must fit a pause. Trim the user window first; Lux audio cannot move.');
    }
    ids.add(block.id);
  }
  if (windows.some((block, i) => i > 0 && block.startMs < windows[i-1].endMs)) throw new Error('Activity blocks overlap. Shorten or remove the existing status first.');
  return document;
}
export function presentationTake(take: RecordedTake, edits: TurnTiming[]): RecordedTake {
  return { ...take, events: take.events.map(event => {
    const edit = ['user-start', 'user-end'].includes(event.type) ? edits.find(edit => edit.utterance === event.utterance) : undefined;
    return edit ? {...event, atMs: event.type === 'user-start' ? edit.userStartMs ?? event.atMs : edit.userEndMs} : event;
  }).sort((a, b) => a.atMs - b.atMs || a.sequence - b.sequence) };
}
export function activityWindows(take: RecordedTake, edits: TurnTiming[], blocks: ActivityBlock[] = []): ActivityBlock[] {
  const turns = userTurns(take);
  return [...edits.filter(edit => edit.status !== 'none').map(edit => ({id: `turn-${edit.utterance}`, startMs: edit.userEndMs,
    endMs: turns.find(turn => turn.utterance === edit.utterance)!.replyMs!, status: edit.status as 'thinking' | 'console', consoleTask: edit.utterance})), ...blocks];
}
export function idleWindows(take: RecordedTake, edits: TurnTiming[]) {
  const adjusted = presentationTake(take, edits);
  const occupied = userTurns(adjusted).map(turn => ({startMs: turn.startMs, endMs: turn.endMs}));
  for (const event of take.events.filter(event => event.type === 'agent-start')) {
    const end = take.events.find(end => end.type === 'agent-end' && end.clip === event.clip && end.atMs >= event.atMs);
    if (end) occupied.push({startMs: event.atMs, endMs: end.atMs});
  }
  occupied.sort((a, b) => a.startMs - b.startMs);
  let cursor = 0; const gaps = [];
  for (const window of occupied) {
    if (window.startMs > cursor) gaps.push({startMs: cursor, endMs: window.startMs});
    cursor = Math.max(cursor, window.endMs);
  }
  const end = take.events.find(event => event.type === 'recording-stop')?.atMs ?? cursor;
  if (end > cursor) gaps.push({startMs: cursor, endMs: end});
  return gaps;
}
export function activityAt(take: RecordedTake, edits: TurnTiming[], timeMs: number, blocks: ActivityBlock[] = []) {
  const block = activityWindows(take, edits, blocks).find(block => timeMs >= block.startMs && timeMs < block.endMs);
  return !block ? null : block.status === 'thinking' ? 'Thinking…' : CONSOLE_ACTIVITIES[block.consoleTask ?? ''] ?? 'Working';
}
