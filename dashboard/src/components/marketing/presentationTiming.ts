import type { RecordedTake } from './recordedCrewTimeline';
export type ActivityKind = 'none' | 'thinking' | 'console';
export interface TurnTiming { utterance: string; userEndMs: number; status: ActivityKind }
export interface PresentationEdits { version: 1; kind: 'demo-presentation-edits'; sourceSha256: string; turns: TurnTiming[] }
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
      || !['none', 'thinking', 'console'].includes(edit.status) || (edit.status !== 'none' && turn.replyMs === undefined)) {
      throw new Error('End time must stay within its original user turn; work status requires a following reply.');
    }
    seen.add(edit.utterance);
  }
  return document;
}
export function presentationTake(take: RecordedTake, edits: TurnTiming[]): RecordedTake {
  return { ...take, events: take.events.map(event => {
    const edit = event.type === 'user-end' ? edits.find(edit => edit.utterance === event.utterance) : undefined;
    return edit ? {...event, atMs: edit.userEndMs} : event;
  }).sort((a, b) => a.atMs - b.atMs || a.sequence - b.sequence) };
}
export function activityAt(take: RecordedTake, edits: TurnTiming[], timeMs: number) {
  const turn = userTurns(take).find(turn => {
    const edit = edits.find(edit => edit.utterance === turn.utterance);
    return edit && edit.status !== 'none' && timeMs >= edit.userEndMs && turn.replyMs !== undefined && timeMs < turn.replyMs;
  });
  if (!turn) return null;
  return edits.find(edit => edit.utterance === turn.utterance)!.status === 'thinking' ? 'Thinking…' : CONSOLE_ACTIVITIES[turn.utterance] ?? 'Working';
}
