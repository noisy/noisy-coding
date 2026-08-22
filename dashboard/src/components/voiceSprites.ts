/** Shared voice→portrait mapping for the avatars sprite (public/avatars.png).
 *  6×6 grid, 34 usable cells; a few assignments are thematic (leo→lion,
 *  luna→moon, rex→crown, zenith→halo), the rest fill in by gender.
 */
export const SPRITE_GRID = 6;

export const SPRITE_CELL: Record<string, number> = {
  // female
  ara: 8, carina: 16, eve: 15, iris: 7, luna: 1, celeste: 32, ursa: 5,
  // male
  altair: 30, atlas: 31, sal: 22, kepler: 12, rex: 23, cosmo: 6, helios: 25,
  leo: 0, lux: 13, sirius: 19, castor: 4, naksh: 18, helix: 21,
  perseus: 28, orion: 27, lumen: 24, rigel: 9, zenith: 17, zagan: 2,
};

/** CSS background properties showing `voice`'s cell, or null when the
 *  voice has no portrait (callers fall back to a monogram). */
export function voiceSpriteStyle(voice: string): Record<string, string> | null {
  const cell = SPRITE_CELL[voice];
  if (cell == null) return null;
  const col = cell % SPRITE_GRID;
  const row = Math.floor(cell / SPRITE_GRID);
  return {
    backgroundImage: "url(/avatars.png)",
    backgroundSize: `${SPRITE_GRID * 100}%`,
    backgroundPosition: `${(col / (SPRITE_GRID - 1)) * 100}% ${(row / (SPRITE_GRID - 1)) * 100}%`,
    transform: "scaleX(-1)",
  };
}
