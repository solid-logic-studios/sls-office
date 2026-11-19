/**
 * Where everything in the Tower sits: a 212 px wide high-rise of seven 52 px storeys under a roof,
 * one lift shaft at the right. Floor indexes count from the bottom: 0 is the basement, 1 the lobby.
 */

export const WIDTH = 212;
/** The sky and the roof above the top storey. */
export const ROOF = 40;
export const STOREY = 52;
export const STOREYS = 7;
export const HEIGHT = ROOF + STOREY * STOREYS;

export const FLOOR = { basement: 0, lobby: 1, storey1: 2, storey2: 3, storey3: 4, storey4: 5, storey5: 6 } as const;

/** What the lift's floor indicator shows for each floor index. */
export const FLOOR_NAMES: readonly string[] = ['B', 'G', '1', '2', '3', '4', '5'];

/** The outside of the shell, and the inside of its two walls. */
export const SHELL_X = { left: 2, right: 210 } as const;
export const INSIDE = { left: 6, right: 206 } as const;

/** The lift shaft: the room interiors end where it starts. */
export const SHAFT = { x: 186, w: 20 } as const;
export const LIFT_X = SHAFT.x + SHAFT.w / 2;

/** The width of one Place, and the least size of any Place's hover box (44 CSS px at 1.5 CSS px an art px). */
export const SLOT = 30;

/** Top of a storey's band: the slab above it. */
export const storeyTop = (floor: number): number => ROOF + (STOREYS - 1 - floor) * STOREY;

/**
 * A storey's lines, top down: the slab above it, the ceiling under the slab, the back of the floor
 * (where the wall ends), the base line desks stand on, the walk line and the front edge of the floor.
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

/** How tall a doorway in a partition is, measured up from the front of the floor. */
export const DOOR_HEIGHT = 32;
