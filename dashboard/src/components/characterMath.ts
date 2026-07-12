/** Angle → value mapping for the editable radial gauges (kept pure). */

// Trait gauges: 280° sweep starting at 130° (prototype geometry).
const TRAIT_START_DEG = 130;
const TRAIT_SWEEP_DEG = 280;

// Speed dial: 250° sweep starting at 145° (rotate(-215) in the prototype).
const SPEED_START_DEG = 145;
const SPEED_SWEEP_DEG = 250;
const SPEED_MIN = 0.7;
const SPEED_MAX = 1.5;

/** Screen angle (deg, 0 = right, clockwise) of a pointer relative to a box center. */
export function pointerAngleDeg(x: number, y: number): number {
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function sweepFraction(angleDeg: number, startDeg: number, sweepDeg: number): number {
  const along = (angleDeg - startDeg + 360) % 360;
  if (along <= sweepDeg) return along / sweepDeg;
  // In the dead zone below the arc: snap to the nearest end.
  return along - sweepDeg < (360 - sweepDeg) / 2 ? 1 : 0;
}

export function traitValueFromAngle(angleDeg: number): number {
  return Math.round(sweepFraction(angleDeg, TRAIT_START_DEG, TRAIT_SWEEP_DEG) * 100);
}

export function speedFromAngle(angleDeg: number): number {
  const raw = SPEED_MIN + sweepFraction(angleDeg, SPEED_START_DEG, SPEED_SWEEP_DEG) * (SPEED_MAX - SPEED_MIN);
  return Math.round(raw * 20) / 20; // 0.05 steps
}

/** All Grok voices, as on the legacy dashboard. */
export const VOICES: Record<string, string> = {
  altair: "male", ara: "female", atlas: "male", carina: "female", castor: "male",
  celeste: "female", cosmo: "male", eve: "female", helios: "male", helix: "male",
  iris: "female", kepler: "male", leo: "male", lumen: "male", luna: "female",
  lux: "male", naksh: "male", orion: "male", perseus: "male", rex: "male",
  rigel: "male", sal: "male", sirius: "male", ursa: "female", zagan: "male",
  zenith: "male",
};
