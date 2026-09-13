import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScrollTracker } from './scroll.ts';

test('scroll milestones are measured once, including thresholds skipped by a jump', () => {
  const events: (string | number)[] = [];
  const track = createScrollTracker({ enabled: true, trackScroll: () => events.push('scroll'), trackDepth: depth => events.push(depth) });
  track(0, 500, 2000);
  track(1, 500, 2000);
  track(1000, 500, 2000);
  track(200, 500, 2000);
  track(1500, 500, 2000);
  track(1500, 500, 2000);
  assert.deepEqual(events, ['scroll', 25, 50, 75, 90, 100]);
});

test('disabled tracking keeps no pre-consent history and ignores pages that cannot scroll', () => {
  const events: (string | number)[] = [];
  const analytics = { enabled: false, trackScroll: () => events.push('scroll'), trackDepth: (depth: number) => events.push(depth) };
  const track = createScrollTracker(analytics);
  track(1500, 500, 2000);
  analytics.enabled = true;
  track(0, 500, 400);
  track(1, 500, 2000);
  analytics.enabled = false;
  track(1500, 500, 2000);
  assert.deepEqual(events, ['scroll', 25]);
});
