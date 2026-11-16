import type { BreakSpot } from '../../contract/theme.ts';

/** Where idle workers drift to. Index order matters: the stage reports busy spots by index. */
export const BREAK_SPOTS: readonly BreakSpot[] = [
  { x: 357, floor: 1, kind: 'coffee' },
  { x: 371, floor: 1, kind: 'coffee' },
  { x: 388, floor: 1, kind: 'fridge' },
  { x: 496, floor: 1, kind: 'couch', sitY: 125 },
  { x: 509, floor: 1, kind: 'couch', sitY: 125 },
  { x: 522, floor: 1, kind: 'couch', sitY: 125 },
  { x: 412, floor: 1, kind: 'putt' },
  { x: 422, floor: 0, kind: 'cooler' },
  { x: 348, floor: 1, kind: 'plant' },
];

export const indexesOf = (kind: string): number[] => BREAK_SPOTS.flatMap((spot, i) => (spot.kind === kind ? [i] : []));
