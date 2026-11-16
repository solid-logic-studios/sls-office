/** Where each storey's back wall, floor and ceiling sit, by floor index (0 is the ground floor). */
export interface FloorBand {
  /** Top of the floor, where the back wall ends. */
  back: number;
  /** Front edge of the floor. */
  front: number;
  /** Top of the back wall. */
  ceil: number;
}

export const FLOOR_BANDS: readonly FloorBand[] = [
  { back: 228, front: 244, ceil: 150 },
  { back: 120, front: 136, ceil: 44 },
];

/** The wall colour of the shell between rooms. */
export const SHELL = '#3b3350';
