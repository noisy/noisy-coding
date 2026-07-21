/** Shared math for the canvas widgets (kept pure for tests). */

/** Amplitude scale for a given mic level: silence stays a faint line,
 * speech breathes up to full swing. */
export function amplitudeFor(level: number): number {
  const clamped = Math.max(0, Math.min(1, level * 1.3));
  return 0.15 + 0.85 * clamped;
}

/** Resize a canvas backing store ONLY when the layout width changed:
 * assigning canvas.width every frame blanks the canvas mid-composite and
 * the scope flickers (the bug fixed in the prototype). */
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  cssHeight: number,
): [CanvasRenderingContext2D, number, number] {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const target = Math.round(width * dpr);
  if (canvas.width !== target) {
    canvas.width = target;
    canvas.height = cssHeight * dpr;
    canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return [canvas.getContext("2d")!, width, cssHeight];
}
