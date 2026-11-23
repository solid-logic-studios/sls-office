/**
 * Where everything in the HQ Spire sits: a 212 px wide spire of seven 52 px storeys under a 40 px
 * roof, one lift shaft at the right. Floor indexes count from the bottom: 0 is the sub-level, 1 the gate.
 * The storeys share the Tower's lines, so a hero is the same size against the furniture as in the HQ.
 */

export const WIDTH = 212;
/** The sky and the roof above the top storey, where the orb floats. */
export const ROOF = 40;
export const STOREY = 52;
export const STOREYS = 7;
export const HEIGHT = ROOF + STOREY * STOREYS;

export const FLOOR = { sublevel: 0, gate: 1, ops1: 2, ops2: 3, hangar: 4, rookieBay: 5, command: 6 } as const;

/** The inside of the hull's two walls. The hull runs the full width of the stage. */
export const INSIDE = { left: 6, right: 206 } as const;

/** The lift shaft, behind a 2 px wall with a doorway on every storey. The rooms end at the wall. */
export const SHAFT_WALL = 186;
export const SHAFT = { x: 188, w: 18 } as const;
export const LIFT_X = SHAFT.x + SHAFT.w / 2;

/** Where the archive ends and the hangar starts, on the hangar storey. */
export const PARTITION_X = 126;

/** The one vertical line the HQ is built on: the orb on the roof, the spine and the core's hub. */
export const AXIS = 99;

/** The width of one Place, and the least size of any Place's hover box (44 CSS px at 1.5 CSS px an art px). */
export const SLOT = 30;

/** Top of a storey's band: the slab above it. */
export const storeyTop = (floor: number): number => ROOF + (STOREYS - 1 - floor) * STOREY;

/**
 * A storey's lines, top down: the slab above it, the ceiling under the slab, the back of the floor
 * (where the wall ends), the base line consoles stand on, the walk line and the front edge of the floor.
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

/** How tall a doorway is, measured up from the front of the floor. A hero is 22 px tall. */
export const DOOR_HEIGHT = 32;
