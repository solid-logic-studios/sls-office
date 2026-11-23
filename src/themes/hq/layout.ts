import type { VmRole } from '../../contract/snapshot.ts';
import type { BreakSpot, Floor, Layout, Place, PlaceArt, Room } from '../../contract/theme.ts';
import { BANDS, BAYS, DECK, HEIGHT, LIFT_X, WIDTH, type Span } from './geometry.ts';
import { ROOMS } from './palette.ts';
import {
  archiveDeskArt,
  consolePlace,
  dispatchDeskArt,
  dockArt,
  founderConsoleArt,
  hangarPostArt,
  medicPostArt,
  padArt,
  postPlace,
  rookieBenchArt,
  watchStationArt,
} from './places.ts';
import { VM_BLURBS } from './rooms.ts';

/** Visitors arrive from the gate, just off stage to the left. */
const OFF_STAGE = -12;
/** Where the keeper loads the jet: on the apron, just outside the hangar door. */
export const JET_RAMP_X = 604;

const FLOORS: readonly Floor[] = [
  { walkY: BANDS[DECK.ground].walk, minX: OFF_STAGE, maxX: JET_RAMP_X + 6 },
  { walkY: BANDS[DECK.upper].walk, minX: 14, maxX: 562 },
];

const walkOf = (deck: number): number => (BANDS[deck] ?? BANDS[DECK.ground]).walk;

function station(art: PlaceArt, x: number, w: number, seat: number, deck: number): Place {
  return consolePlace(art, x, w, seat, deck, walkOf(deck));
}

function post(art: PlaceArt, x: number, deck: number, w?: number, h?: number): Place {
  return postPlace(art, x, deck, walkOf(deck), w, h);
}

/** A room from its ceiling to the front of its floor. */
function room([x0, x1]: Span, deck: number, role: VmRole): Room {
  const { ceil, front } = BANDS[deck] ?? BANDS[DECK.ground];
  return { x: x0, y: ceil, w: x1 - x0, h: front - ceil, blurb: VM_BLURBS[role] };
}

/** Twelve watch stations along the ops floor, 29 px apart. */
const WATCH_STATIONS = 12;
const watchStations = Array.from({ length: WATCH_STATIONS }, (_, i) =>
  station(watchStationArt, 88 + i * 29, 24, 14, DECK.ground),
);

/**
 * Index order matters: the stage reports busy spots by index. The kinds key the line bank's
 * `breakSpot` chatter (`BREAK_SPOT_KINDS` in `lines.ts`).
 */
const BREAK_SPOTS: readonly BreakSpot[] = [
  { x: 283, floor: DECK.upper, kind: 'brew' },
  { x: 295, floor: DECK.upper, kind: 'brew' },
  { x: 496, floor: DECK.upper, kind: 'couch', sitY: 125 },
  { x: 509, floor: DECK.upper, kind: 'couch', sitY: 125 },
  { x: 522, floor: DECK.upper, kind: 'couch', sitY: 125 },
  { x: 548, floor: DECK.upper, kind: 'bag' },
  { x: 422, floor: DECK.ground, kind: 'holo' },
  { x: 436, floor: DECK.upper, kind: 'trophy' },
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
    pod: [44, 76, 108].map((x) => station(rookieBenchArt, x, 24, 12, DECK.upper)),
    // 28 wide, not the Office's 46, so Vitals's post at x 74 stands clear of it.
    greeter: [station(dispatchDeskArt, 40, 28, 16, DECK.ground)],
    guard: [post(padArt(ROOMS.ops.accent), 20, DECK.ground), post(padArt(ROOMS.ops.accent), 31, DECK.ground)],
    checker: [post(medicPostArt, 74, DECK.ground)],
    keeper: [station(archiveDeskArt, 186, 24, 14, DECK.upper)],
    courier: [post(hangarPostArt, 508, DECK.ground, 16)],
    wrangler: [post(padArt(ROOMS.rookieBay.accent), 27, DECK.upper)],
    // In the founders' order: the JARVIS remote's dock, then Paul's console and Dhruv's, either side of the orb.
    founder: [
      post(dockArt, 420, DECK.upper, 12, 16),
      station(founderConsoleArt, 304, 30, 16, DECK.upper),
      station(founderConsoleArt, 382, 30, 16, DECK.upper),
    ],
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
