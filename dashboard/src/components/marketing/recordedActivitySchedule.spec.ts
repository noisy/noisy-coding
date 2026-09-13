import { describe, expect, it } from 'vitest';
import { recordedActivitySchedule } from './recordedActivitySchedule';
import take from './recorded-hero/hero-recording.json';
import saved from '../../../../tools/demo-recorder/takes/hero-v1/presentation-edits.json';
import type { ActivityBlock, TurnTiming } from './presentationTiming';

describe('homepage activity schedule in actor recordings', () => {
  const schedule = recordedActivitySchedule(take, saved.turns as TurnTiming[], saved.activities as ActivityBlock[]);
  it('keeps the full authored edit window before the partial-names reply', () => {
    const reply = take.events.find(event => event.type === 'agent-start' && event.clip === 'hero-lux-search-2')!;
    expect(schedule.beforeReply['hero-lux-search-2']).toEqual([{ durationMs: reply.atMs - 30348, text: 'Editing src/search.ts' }]);
  });
  it('keeps the independently authored editing work after the first reply', () => {
    expect(schedule.beforeTurn.u2.filter(pause => pause.text)).toEqual([{ durationMs: 3333, text: 'Editing src/search.ts' }]);
    const replyEnd = take.events.find(event => event.type === 'agent-end' && event.clip === 'hero-lux-search-1')!;
    expect(schedule.beforeTurn.u2.reduce((sum, pause) => sum + pause.durationMs, 0)).toBeCloseTo(20889 - replyEnd.atMs);
  });
  it('preserves deployment activity and quiet gaps between the two final replies', () => {
    expect(schedule.beforeReply['hero-lux-search-production'].map(pause => pause.text)).toEqual([null, 'Deploying to production', null]);
    expect(schedule.beforeReply['hero-lux-search-production'][1].durationMs).toBe(2293);
  });
});
