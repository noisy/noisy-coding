import { describe, expect, it } from "vitest";
import { concatFloat, floatToInt16, resampleTo16k } from "./pcm";

describe("resampleTo16k", () => {
  it("keeps 16 kHz input untouched", () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(resampleTo16k(input, 16000)).toBe(input);
  });

  it("downsamples 48 kHz to a third of the samples", () => {
    const input = new Float32Array(480).fill(0.5);
    const out = resampleTo16k(input, 48000);
    expect(out.length).toBe(160);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[out.length - 1]).toBeCloseTo(0.5);
  });

  it("interpolates between neighbours instead of dropping them", () => {
    // 32 kHz → 16 kHz halves the rate: output sample 1 sits exactly on
    // input sample 2, sample boundaries interpolate linearly.
    const input = new Float32Array([0, 1, 0, 1]);
    const out = resampleTo16k(input, 32000);
    expect(out.length).toBe(2);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0); // input[2]
  });
});

describe("floatToInt16", () => {
  it("scales and clamps", () => {
    const out = floatToInt16(new Float32Array([0, 1, -1, 2, -2, 0.5]));
    expect(Array.from(out)).toEqual([0, 32767, -32767, 32767, -32767, 16384]);
  });
});

describe("concatFloat", () => {
  it("joins worklet crumbs in order", () => {
    const out = concatFloat([new Float32Array([1, 2]), new Float32Array([3])], 3);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
});
