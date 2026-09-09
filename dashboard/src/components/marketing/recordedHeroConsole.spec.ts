import { expect, it } from 'vitest';
import take from './recorded-hero/hero-recording.json';
import { recordedHeroConsoleAt } from './recordedHeroConsole';
it('keeps production success after its recorded confirmation and restores earlier work when seeking back', () => {
  const confirmation = take.events.find(event => event.type === 'agent-start' && event.clip === 'hero-lux-search-production')!.atMs;
  expect(recordedHeroConsoleAt(take, confirmation - 1)).toContainEqual({ kind: 'detail', text: 'Building and publishing production…' });
  expect(recordedHeroConsoleAt(take, confirmation - 1).some(line => line.kind === 'pass' && line.text.includes('deployment complete'))).toBe(false);
  expect(recordedHeroConsoleAt(take, confirmation)).toContainEqual({ kind: 'pass', text: 'Production deployment complete. Search health check passed.' });
  expect(recordedHeroConsoleAt(take, 35000)).toContainEqual({ kind: 'tool', tool: 'Edit', arg: 'src/search.ts' });
  expect(recordedHeroConsoleAt(take, 35000).some(line => line.kind === 'tool' && line.arg.includes('deploy'))).toBe(false);
  expect(recordedHeroConsoleAt(take, 0).some(line => line.kind === 'tool' && line.arg.includes('deploy'))).toBe(false);
});
