import { expect, it } from 'vitest';
import take from './recorded-hero/hero-recording.json';
import { activityAt, presentationTake, validatePresentation } from './presentationTiming';
import { recordedCrewAt } from './recordedCrewTimeline';
it('ends listening earlier while preserving transcript arrivals, media and reply times', () => {
  const edits = [{utterance: 'u1', userEndMs: 10500, status: 'thinking' as const}];
  const adjusted = presentationTake(take, edits);
  expect(adjusted.events.filter(event => event.type !== 'user-end')).toEqual(take.events.filter(event => event.type !== 'user-end'));
  expect(recordedCrewAt(adjusted, 11000).mode).toBe('idle');
  expect(recordedCrewAt(adjusted, 13000).feed[0].text).toContain('part of a name gives me nothing');
  expect([activityAt(take, edits, 10499), activityAt(take, edits, 11000), activityAt(take, edits, 13000)]).toEqual([null, 'Thinking…', null]);
  expect(take.events.find(event => event.type === 'user-end')!.atMs).toBeGreaterThan(10500);
});
it('rejects timing from another source or outside the selected user turn', () => {
  const document = {version: 1, kind: 'demo-presentation-edits', sourceSha256: 'source1', turns: [{utterance: 'u1', userEndMs: 10500, status: 'console'}]};
  expect(validatePresentation(document, take, 'source1')).toBe(document);
  expect(() => validatePresentation(document, take, 'source2')).toThrow();
  expect(() => validatePresentation({...document, turns: [{utterance: 'u1', userEndMs: 14000, status: 'thinking'}]}, take, 'source1')).toThrow();
});
