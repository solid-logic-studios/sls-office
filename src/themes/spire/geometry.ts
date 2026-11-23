/**
 * Where everything in the HQ Spire sits: a 212 px wide spire of seven 52 px storeys under a 40 px
 * roof, one lift shaft at the right. Floor indexes count from the bottom: 0 is the sub-level, 1 the gate.
 * The storeys share the Tower's lines (`shared/storeys.ts`), so a hero is the same size against the
 * furniture as in the HQ.
 */

export { HEIGHT, ROOF, SLOT, STOREY, STOREYS, band, storeyTop, type Band } from '../shared/storeys.ts';

export const WIDTH = 212;

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

/** How tall a doorway is, measured up from the front of the floor. A hero is 22 px tall. */
export const DOOR_HEIGHT = 32;
