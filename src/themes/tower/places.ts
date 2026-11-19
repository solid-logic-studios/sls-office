import type { Place, PlaceArt } from '../../contract/theme.ts';
import {
  archiveDeskArt,
  founderDeskArt,
  podBenchArt,
  postArt,
  receptionDeskArt,
  workerDeskArt,
} from '../office/places.ts';
import { SLOT, band } from './geometry.ts';

/**
 * The Office's furniture in 30 px slots. Every hover box is at least 30 by 30, so it is a 44 CSS px
 * touch target at the legible scale; the Office art is narrower and is drawn centred in its slot.
 */

/** Office art drawn `dx` px into its slot, at the `w` it was drawn for. */
function inset(art: PlaceArt, dx: number, w: number): PlaceArt {
  return (painter, view) => art(painter, { ...view, place: { ...view.place, x: view.place.x + dx, w } });
}

interface Furniture {
  art: PlaceArt;
  /** The Office art's own width; the slot is this wide or wider. */
  w: number;
  /** Where the sitter sits, from the left of the art. */
  seat: number;
}

const DESKS = {
  worker: { art: workerDeskArt, w: 24, seat: 14 },
  pod: { art: podBenchArt, w: 24, seat: 12 },
  keeper: { art: archiveDeskArt, w: 24, seat: 14 },
  founder: { art: founderDeskArt, w: 30, seat: 16 },
  greeter: { art: receptionDeskArt, w: 46, seat: 26 },
} as const satisfies Record<string, Furniture>;

/** A desk on `floor` with its slot's left edge at `x`. The slot is one `SLOT` wide, or as wide as wider art. */
export function desk(kind: keyof typeof DESKS, x: number, floor: number): Place {
  const { art, w, seat } = DESKS[kind];
  const slot = Math.max(SLOT, w);
  const dx = Math.floor((slot - w) / 2);
  const { desk: baseY } = band(floor);
  return {
    x,
    w: slot,
    h: SLOT,
    baseY,
    floor,
    seat: { x: x + dx + seat, y: baseY - 3 },
    art: dx === 0 ? art : inset(art, dx, w),
  };
}

/** A character stands on the walk line in the middle of a 30 px slot; there is no furniture. */
export function post(x: number, floor: number): Place {
  return { x, w: SLOT, h: SLOT, baseY: band(floor).walk, floor, seat: { x: x + SLOT / 2 }, art: postArt };
}
