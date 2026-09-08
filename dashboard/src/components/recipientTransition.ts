/** Interpolate all Mic slots together so their total width stays constant. */
export function interpolateRecipientWeights(from: Record<string, number>, recipient: string | null, progress: number): Record<string, number> {
  const eased = progress * progress * (3 - 2 * progress);
  const names = new Set([...Object.keys(from), ...(recipient ? [recipient] : [])]);
  return Object.fromEntries([...names].map(name => [
    name, (from[name] ?? 0) * (1 - eased) + (name === recipient ? eased : 0),
  ]));
}
