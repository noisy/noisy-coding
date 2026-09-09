// Raw arrival times are immutable. Only transcript display times are derived.
export function presentationEvents(events, offsets = {}) {
  const starts = new Map(events.filter(e => e.type === 'user-start').map(e => [e.utterance, e.atMs]));
  return events.map(event => ({
    ...event,
    displayAtMs: event.type === 'transcript'
      ? Math.max(starts.get(event.utterance) ?? 0, event.atMs + (offsets[event.utterance] ?? 0))
      : event.atMs,
  })).sort((a, b) => a.displayAtMs - b.displayAtMs || a.sequence - b.sequence);
}

export function transcriptsAt(events, timeMs, offsets = {}) {
  const lines = new Map();
  for (const event of presentationEvents(events, offsets)) {
    if (event.displayAtMs > timeMs) break;
    if (event.type === 'transcript') lines.set(event.utterance, event.text);
  }
  return [...lines].map(([utterance, text]) => ({ utterance, text }));
}

export function activeClipAt(events, timeMs) {
  let current = null;
  for (const event of events) {
    if (event.atMs > timeMs) break;
    if (event.type === 'agent-start') current = event;
    if (event.type === 'agent-end' || event.type === 'recording-stop') current = null;
  }
  return current;
}

export const TURNS = [
  { prompt: "how's staging?", agent: 'Lux', replies: [
    { voice: 'Lux', clip: 'lux-1', text: 'Green! Ready to promote.' },
  ] },
  { prompt: 'do it', agent: 'Lux', replies: [
    { voice: 'Lux', clip: 'lux-2', text: 'on it!' },
    { voice: 'Rex', clip: 'rex-1', text: "Last week's PR - finally approved!!!", handover: true },
    { voice: 'Luna', clip: 'luna-1', text: 'Alarm went off! It was the courier.', handover: true },
    { voice: 'Luna', clip: 'luna-2', text: 'Package is big - probably the printer.' },
  ] },
  { prompt: 'thanks', agent: 'Luna', replies: [] },
];
