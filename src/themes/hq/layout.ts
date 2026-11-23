import type { VmRole } from '../../contract/snapshot.ts';
import type { BreakSpot, Floor, Layout, Place, PlaceArt, Room } from '../../contract/theme.ts';
// Stand-in furniture: the HQ's own consoles replace these (docs/design/hq-theme.md, slice 3).
import {
  archiveDeskArt,
  founderDeskArt,
  podBenchArt,
  postArt,
  receptionDeskArt,
  workerDeskArt,
} from '../office/places.ts';
import { VM_BLURBS } from '../office/rooms.ts';
import { BANDS, BAYS, DECK, HEIGHT, LIFT_X, WIDTH, type Span } from './geometry.ts';

/** Visitors arrive from the gate, just off stage to the left. */
const OFF_STAGE = -12;
/** Where the keeper loads the jet: on the apron, just outside the hangar door. */
export const JET_RAMP_X = 604;

const FLOORS: readonly Floor[] = [
  { walkY: BANDS[DECK.ground].walk, minX: OFF_STAGE, maxX: JET_RAMP_X + 6 },
  { walkY: BANDS[DECK.upper].walk, minX: 14, maxX: 562 },
];

/** A seated Place stands 8 px behind the walk line, and its sitter 3 px behind that. */
const SEAT_BACK = 6;
const SITTER_BACK = 9;

function station(art: PlaceArt, x: number, w: number, seat: number, deck: number): Place {
  const { walk } = BANDS[deck] ?? BANDS[DECK.ground];
  return { x, w, h: 21, baseY: walk - SEAT_BACK, floor: deck, seat: { x: x + seat, y: walk - SITTER_BACK }, art };
}

/** Somewhere to stand on the walk line: the box is about the size of a person. */
function post(x: number, deck: number): Place {
  const { walk } = BANDS[deck] ?? BANDS[DECK.ground];
  return { x: x - 6, w: 12, h: 22, baseY: walk, floor: deck, seat: { x }, art: postArt };
}

/** A room from its ceiling to the front of its floor. */
function room([x0, x1]: Span, deck: number, role: VmRole): Room {
  const { ceil, front } = BANDS[deck] ?? BANDS[DECK.ground];
  return { x: x0, y: ceil, w: x1 - x0, h: front - ceil, blurb: VM_BLURBS[role] };
}

/** Twelve watch stations along the ops floor, 29 px apart. */
const WATCH_STATIONS = 12;
const watchStations = Array.from({ length: WATCH_STATIONS }, (_, i) =>
  station(workerDeskArt, 88 + i * 29, 24, 14, DECK.ground),
);

/** Index order matters: the stage reports busy spots by index. The kinds are the Office's until the HQ has its own lines. */
const BREAK_SPOTS: readonly BreakSpot[] = [
  { x: 283, floor: DECK.upper, kind: 'coffee' },
  { x: 295, floor: DECK.upper, kind: 'coffee' },
  { x: 496, floor: DECK.upper, kind: 'couch', sitY: 125 },
  { x: 509, floor: DECK.upper, kind: 'couch', sitY: 125 },
  { x: 522, floor: DECK.upper, kind: 'couch', sitY: 125 },
  { x: 548, floor: DECK.upper, kind: 'plant' },
  { x: 422, floor: DECK.ground, kind: 'cooler' },
  { x: 436, floor: DECK.upper, kind: 'plant' },
];

export const HQ_LAYOUT: Layout = {
  width: WIDTH,
  height: HEIGHT,
  floors: FLOORS,
  liftX: LIFT_X,
  entrance: { x: OFF_STAGE, floor: DECK.ground },
  rooms: {
    ci: room(BAYS.rookieBay, DECK.upper, 'ci'),
    data: room(BAYS.archive, DECK.upper, 'data'),
    compute: room(BAYS.ops, DECK.ground, 'compute'),
    deploy: room(BAYS.hangar, DECK.ground, 'deploy'),
  },
  homes: {
    worker: watchStations,
    pod: [44, 76, 108].map((x) => station(podBenchArt, x, 24, 12, DECK.upper)),
    greeter: [station(receptionDeskArt, 40, 46, 26, DECK.ground)],
    guard: [post(20, DECK.ground), post(31, DECK.ground)],
    checker: [post(74, DECK.ground)],
    keeper: [station(archiveDeskArt, 186, 24, 14, DECK.upper)],
    courier: [post(508, DECK.ground)],
    wrangler: [post(27, DECK.upper)],
    // Either side of the JARVIS console.
    founder: [station(founderDeskArt, 304, 30, 16, DECK.upper), station(founderDeskArt, 382, 30, 16, DECK.upper)],
  },
  breakSpots: BREAK_SPOTS,
  // In front of the two archive lockers: PostgreSQL, then MySQL.
  stores: [
    { x: 165, floor: DECK.upper },
    { x: 233, floor: DECK.upper },
  ],
  vault: { x: JET_RAMP_X, floor: DECK.ground },
  // The suit-up tube in the rookie bay's left wall.
  podSpawn: { x: 20, floor: DECK.upper },
};
