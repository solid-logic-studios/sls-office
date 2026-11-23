/**
 * The storey grid the Tower and the HQ Spire share: seven 52 px storeys under a 40 px roof, floor
 * indexes counting from the bottom. Sharing it keeps a person the same size against the furniture in both.
 */

/** The sky and the roof above the top storey. */
export const ROOF = 40;
export const STOREY = 52;
export const STOREYS = 7;
export const HEIGHT = ROOF + STOREY * STOREYS;

/** The width of one Place, and the least size of any Place's hover box (44 CSS px at 1.5 CSS px an art px). */
export const SLOT = 30;

/** Top of a storey's band: the slab above it. */
export const storeyTop = (floor: number): number => ROOF + (STOREYS - 1 - floor) * STOREY;

/**
 * A storey's lines, top down: the slab above it, the ceiling under the slab, the back of the floor
 * (where the wall ends), the base line furniture stands on, the walk line and the front edge of the floor.
 */
export interface Band {
  top: number;
  ceil: number;
  back: number;
  desk: number;
  walk: number;
  front: number;
}

export function band(floor: number): Band {
  const top = storeyTop(floor);
  return { top, ceil: top + 3, back: top + 38, desk: top + 42, walk: top + 48, front: top + 50 };
}
