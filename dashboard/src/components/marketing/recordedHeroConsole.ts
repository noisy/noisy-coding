import { activityWindows, type ActivityBlock, type TurnTiming } from './presentationTiming';
import type { RecordedTake } from './recordedCrewTimeline';

type TerminalLine =
  | { kind: 'prompt' | 'text' | 'detail' | 'pass'; text: string }
  | { kind: 'tool'; tool: string; arg: string };

/** Console milestones follow the recorded reply boundaries, not independent
 * timers. More precise thinking/activity cues can be authored separately. */
export function recordedHeroConsoleAt(take: RecordedTake, timeMs: number, edits: TurnTiming[] = [], blocks: ActivityBlock[] = []): TerminalLine[] {
  const lines: TerminalLine[] = [
    { kind: 'prompt', text: 'Simplify the search filter.' },
    { kind: 'tool', tool: 'Edit', arg: 'src/search.ts' },
    { kind: 'text', text: 'Search filter updated. Ready for review.' },
  ];
  const workStarts: RecordedTake['events'] = activityWindows(take, edits, blocks).filter(block => block.status === 'console').map(block => ({
    sequence: Number.MAX_SAFE_INTEGER, atMs: block.startMs, type: 'work-start', utterance: block.consoleTask,
  }));
  const events = [...take.events, ...workStarts].sort((a, b) => a.atMs - b.atMs || a.sequence - b.sequence);
  const started = (utterance: string, atMs: number) => workStarts.some(event => event.utterance === utterance && event.atMs <= atMs);
  const work: Record<string, TerminalLine[]> = {
    u1: [{kind: 'tool', tool: 'Bash', arg: 'git diff HEAD~1 -- src/search.ts'}, {kind: 'tool', tool: 'Read', arg: 'src/search.ts'}],
    u2: [{kind: 'tool', tool: 'Edit', arg: 'src/search.ts'}],
    u3: [{kind: 'tool', tool: 'Write', arg: 'src/search.test.ts'}, {kind: 'tool', tool: 'Bash', arg: 'npm test -- search'}],
    u4: [{kind: 'tool', tool: 'Bash', arg: 'npm run deploy -- --environment production'}, {kind: 'detail', text: 'Building and publishing production…'}],
  };
  for (const event of events) {
    if (event.atMs > timeMs) continue;
    if (event.type === 'user-end') {
      const prompt = take.events.find(item => item.type === 'user-start' && item.utterance === event.utterance);
      // Use the recording's actual transcript as soon as it is available.
      const text = take.events.filter(item => item.type === 'transcript' && item.utterance === event.utterance && item.atMs <= timeMs).at(-1)?.text;
      if (text && prompt) lines.push({ kind: 'prompt', text });
    }
    if (event.type === 'work-start') lines.push(...(work[event.utterance!] ?? []));
    if (event.type !== 'agent-start') continue;
    switch (event.clip) {
      case 'hero-lux-search-1':
        if (!started('u1', event.atMs)) lines.push(...work.u1);
        lines.push({ kind: 'detail', text: 'Found: name === query replaced partial matching.' });
        break;
      case 'hero-lux-search-2':
        if (!started('u2', event.atMs)) lines.push(...work.u2);
        lines.push({ kind: 'detail', text: 'name.toLowerCase().includes(query.toLowerCase())' });
        break;
      case 'hero-lux-search-3':
        if (!started('u3', event.atMs)) lines.push(...work.u3);
        lines.push({ kind: 'pass', text: 'PASS partial name · PASS mixed case — 2 tests passed' });
        break;
      case 'hero-lux-search-4':
        if (!started('u4', event.atMs)) lines.push(...work.u4);
        break;
      case 'hero-lux-search-production':
        lines.push({ kind: 'pass', text: 'Production deployment complete. Search health check passed.' });
        break;
    }
  }
  return lines.slice(-12);
}
