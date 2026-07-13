/** PCM conversion for the browser-tab microphone.
 *
 * The daemon's VAD/STT pipeline expects int16 mono 16 kHz; browsers
 * capture float32 at the AudioContext rate (usually 48 kHz). Pure
 * functions — the composable owns the I/O.
 */

export const TARGET_SAMPLE_RATE = 16000;

/** Linear-interpolation resample to 16 kHz — plenty for speech. */
export function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === TARGET_SAMPLE_RATE) return input;
  const outLength = Math.floor((input.length * TARGET_SAMPLE_RATE) / fromRate);
  const out = new Float32Array(outLength);
  const step = fromRate / TARGET_SAMPLE_RATE;
  for (let i = 0; i < outLength; i++) {
    const pos = i * step;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    out[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return out;
}

/** Float [-1, 1] → int16, clamping out-of-range samples instead of wrapping. */
export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    out[i] = Math.round(clamped * 32767);
  }
  return out;
}

/** Concatenate float chunks (the worklet delivers ~128-sample crumbs). */
export function concatFloat(chunks: Float32Array[], totalLength: number): Float32Array {
  const out = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
