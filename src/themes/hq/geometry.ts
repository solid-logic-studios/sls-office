import type { Rect } from '../../contract/theme.ts';

/**
 * Where the HQ sits on its 660 by 300 stage: two decks over a sub-level, one lift shaft, a gate at
 * the left and a jet apron at the right. The decks share the Office's lines, so a person is the same
 * size against the furniture in both Themes.
 */

export const WIDTH = 660;
export const HEIGHT = 300;

/** Floor indexes, bottom first. The sub-level has no floor: nobody walks there. */
export const DECK = { ground: 0, upper: 1 } as const;

/** A deck's lines, top down: the top of its back wall, where the wall ends, and the front edge of the floor. */
export interface DeckBand {
  ceil: number;
  back: number;
  front: number;
  /** The line people walk along. */
  walk: number;
}

export const BANDS: readonly [DeckBand, DeckBand] = [
  { ceil: 150, back: 228, front: 244, walk: 242 },
  { ceil: 44, back: 120, front: 136, walk: 134 },
];

/** The hull: the outside of the building above the ground. */
export const HULL_RECT: Rect = { x: 8, y: 40, w: 560, h: 208 };

/** The ground line outside, and the slab between the ground deck and the sub-level. */
export const GROUND_Y = 244;

/** The sub-level chamber under the building: the lab host. */
export const SUBLEVEL: Rect = { x: 8, y: 250, w: 560, h: 48 };

/** The lift shaft, joining both decks. */
export const SHAFT = { x: 446, w: 24 } as const;
export const LIFT_X = SHAFT.x + SHAFT.w / 2;

/** A room's interior span, left wall to right wall. */
export type Span = readonly [x0: number, x1: number];

/** The rooms, by deck. Walls are 4 px thick; the shaft has a 4 px wall either side. */
export const BAYS = {
  rookieBay: [14, 140],
  archive: [144, 270],
  command: [274, 442],
  rec: [474, 562],
  ops: [14, 442],
  hangar: [474, 562],
} as const satisfies Record<string, Span>;

/** The jet apron outside the hangar door, out to the edge of the stage. */
export const APRON: Span = [568, WIDTH];

/** The rec room couch. Its break spots in `layout.ts` and its art in `upper-deck.ts` both read it. */
export const COUCH = { x: 484, base: 128, w: 50 } as const;
