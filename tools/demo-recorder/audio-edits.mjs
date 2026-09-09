export function validateRange(range, durationMs) {
  if (!range || !Number.isInteger(range.startMs) || !Number.isInteger(range.endMs)
      || range.startMs < 0 || range.endMs <= range.startMs || range.endMs > durationMs) {
    throw new Error('Choose a start before the end, within the recording (whole milliseconds).');
  }
  return { startMs: range.startMs, endMs: range.endMs };
}
const overlaps = (a, b) => a.startMs < b.endMs && b.startMs < a.endMs;
export function validateEdits(document, source) {
  if (document.version !== 1 || document.kind !== 'demo-audio-edits') throw new Error('Unsupported audio edit file.');
  if (document.source?.sha256 !== source.sha256 || document.source?.size !== source.size) {
    throw new Error('These markers belong to a different original recording.');
  }
  if (!Array.isArray(document.repairs)) throw new Error('Missing repair intervals.');
  const repairs = document.repairs.map(range => validateRange(range, source.durationMs)).sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < repairs.length; i++) {
    if (overlaps(repairs[i - 1], repairs[i])) throw new Error('Repair intervals overlap. Adjust their boundaries or use one interval.');
  }
  const roomTone = document.roomTone ? validateRange(document.roomTone, source.durationMs) : null;
  if (roomTone && repairs.some(range => overlaps(range, roomTone))) {
    throw new Error('The clean background sample cannot overlap a repair interval.');
  }
  return { version: 1, kind: 'demo-audio-edits', source, repairs, roomTone };
}
