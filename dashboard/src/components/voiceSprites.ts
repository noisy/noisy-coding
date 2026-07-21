/** Shared voice→portrait mapping for the avatars sprite (public/avatars.png).
 *  6×6 grid, 34 usable cells; a few assignments are thematic (leo→lion,
 *  luna→moon, rex→crown, zenith→halo), the rest fill in by gender.
 */
export const SPRITE_GRID = 6;

export const SPRITE_CELL: Record<string, number> = {
  // female
  ara: 1, carina: 3, eve: 5, iris: 10, luna: 15, celeste: 16, ursa: 29,
  // male
  altair: 0, atlas: 2, sal: 4, kepler: 6, rex: 8, cosmo: 9, helios: 14,
  leo: 12, lux: 13, sirius: 17, castor: 18, naksh: 19, helix: 21,
  perseus: 22, orion: 23, lumen: 24, rigel: 27, zenith: 31, zagan: 30,
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
