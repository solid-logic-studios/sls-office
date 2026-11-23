import type { Place, PlaceArt } from '../../contract/theme.ts';
import {
  archiveDeskArt,
  dispatchDeskArt,
  dockArt,
  founderConsoleArt,
  hangarPostArt,
  medicPostArt,
  padArt,
  rookieBenchArt,
  watchStationArt,
} from '../hq/places.ts';
import { ROOMS } from '../hq/palette.ts';
import { SLOT, band } from './geometry.ts';

/**
 * The HQ's furniture in 30 px slots. Every hover box is at least 30 by 30, so it is a 44 CSS px
 * touch target at the legible scale; the HQ art is narrower and is drawn centred in its slot.
 */

/** HQ art drawn `dx` px into its slot, at the `w` it was drawn for. */
function inset(art: PlaceArt, dx: number, w: number): PlaceArt {
  return (painter, view) => art(painter, { ...view, place: { ...view.place, x: view.place.x + dx, w } });
}

interface Furniture {
  art: PlaceArt;
  /** The HQ art's own width; the slot is this wide or wider. */
  w: number;
}

interface Console extends Furniture {
  /** Where the sitter sits, from the left of the art. */
  seat: number;
}

const CONSOLES = {
  watch: { art: watchStationArt, w: 24, seat: 14 },
  dispatch: { art: dispatchDeskArt, w: 28, seat: 16 },
  archive: { art: archiveDeskArt, w: 24, seat: 14 },
  founder: { art: founderConsoleArt, w: 30, seat: 16 },
  bench: { art: rookieBenchArt, w: 24, seat: 12 },
} as const satisfies Record<string, Console>;

const POSTS = {
  gate: { art: padArt(ROOMS.ops.accent), w: 10 },
  drill: { art: padArt(ROOMS.rookieBay.accent), w: 10 },
  medic: { art: medicPostArt, w: 10 },
  hangar: { art: hangarPostArt, w: 16 },
  dock: { art: dockArt, w: 12 },
} as const satisfies Record<string, Furniture>;

/** A seated Place's base line is 6 px behind the walk line (the storey's desk line), and its sitter 9 px behind. */
const SITTER_BACK = 9;

/** A console on `floor` with its slot's left edge at `x`. */
export function seat(kind: keyof typeof CONSOLES, x: number, floor: number): Place {
  const { art, w, seat: at } = CONSOLES[kind];
  const dx = Math.floor((SLOT - w) / 2);
  const { desk, walk } = band(floor);
  return {
    x,
    w: SLOT,
    h: SLOT,
    baseY: desk,
    floor,
    seat: { x: x + dx + at, y: walk - SITTER_BACK },
    art: inset(art, dx, w),
  };
}

/** Somewhere to stand on the walk line, in the middle of a slot whose left edge is at `x`. */
export function post(kind: keyof typeof POSTS, x: number, floor: number): Place {
  const { art, w } = POSTS[kind];
  const dx = (SLOT - w) / 2;
  return { x, w: SLOT, h: SLOT, baseY: band(floor).walk, floor, seat: { x: x + SLOT / 2 }, art: inset(art, dx, w) };
}
