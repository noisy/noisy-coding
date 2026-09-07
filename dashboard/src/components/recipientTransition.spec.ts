import { describe, expect, it } from 'vitest';
import { interpolateRecipientWeights } from './recipientTransition';

describe('microphone recipient width', () => {
  it('conserves the total width when a move is interrupted by a third tab', () => {
    const interrupted = interpolateRecipientWeights({ codex: 1 }, 'review', 0.3);
    const totals = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(progress =>
      Object.values(interpolateRecipientWeights(interrupted, 'docs', progress)).reduce((sum, weight) => sum + weight, 0),
    );
    for (const total of totals) expect(total).toBeCloseTo(1, 12);
  });

  it('ends with space only in the selected tab', () => {
    expect(interpolateRecipientWeights({ codex: 0.4, review: 0.6 }, 'docs', 1)).toEqual({ codex: 0, review: 0, docs: 1 });
  });

  it('removes all recipient space when no agent is active', () => {
    expect(interpolateRecipientWeights({ codex: 1 }, null, 1)).toEqual({ codex: 0 });
  });
});
