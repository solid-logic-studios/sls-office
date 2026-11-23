/**
 * Where everything in the Tower sits: a 212 px wide high-rise of seven 52 px storeys under a roof,
 * one lift shaft at the right. Floor indexes count from the bottom: 0 is the basement, 1 the lobby.
 */

export { HEIGHT, ROOF, SLOT, STOREY, STOREYS, band, storeyTop, type Band } from '../shared/storeys.ts';

export const WIDTH = 212;

export const FLOOR = { basement: 0, lobby: 1, storey1: 2, storey2: 3, storey3: 4, storey4: 5, storey5: 6 } as const;

/** What the lift's floor indicator shows for each floor index. */
export const FLOOR_NAMES: readonly string[] = ['B', 'G', '1', '2', '3', '4', '5'];

/** The outside of the shell, and the inside of its two walls. */
export const SHELL_X = { left: 2, right: 210 } as const;
export const INSIDE = { left: 6, right: 206 } as const;

/** The lift shaft: the room interiors end where it starts. */
export const SHAFT = { x: 186, w: 20 } as const;
export const LIFT_X = SHAFT.x + SHAFT.w / 2;

/** How tall a doorway in a partition is, measured up from the front of the floor. */
export const DOOR_HEIGHT = 32;
