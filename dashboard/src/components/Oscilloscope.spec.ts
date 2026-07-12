import { describe, expect, it } from "vitest";
import { amplitudeFor } from "./waveMath";

describe("amplitudeFor", () => {
  it("keeps a faint idle line at silence and full swing at max level", () => {
    expect(amplitudeFor(0)).toBeCloseTo(0.15);
    expect(amplitudeFor(1)).toBeCloseTo(1.0);
  });

  it("clamps out-of-range levels", () => {
    expect(amplitudeFor(-3)).toBeCloseTo(0.15);
    expect(amplitudeFor(9)).toBeCloseTo(1.0);
  });
});
