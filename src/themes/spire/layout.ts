import type { VmRole } from '../../contract/snapshot.ts';
import type { BreakSpot, Floor, Layout, Room } from '../../contract/theme.ts';
import { VM_BLURBS } from '../hq/rooms.ts';
import { COUCH, HOLO_PEDESTAL, SILO } from './boards.ts';
import {
  AXIS,
  FLOOR,
  HEIGHT,
  INSIDE,
  LIFT_X,
  PARTITION_X,
  SHAFT_WALL,
  SLOT,
  STOREYS,
  WIDTH,
  band,
} from './geometry.ts';
import { post, seat } from './places.ts';
import { BAG_SPOT_X, BREW, MYSQL, PGSQL, TUBE } from './set.ts';

/** Visitors arrive from the street, just off stage to the left of the gate. */
const OFF_STAGE = -12;

/** Everyone walks the whole storey; the gate also reaches the street off stage to the left. */
const FLOORS: readonly Floor[] = Array.from({ length: STOREYS }, (_, floor) => ({
  walkY: band(floor).walk,
  minX: floor === FLOOR.gate ? OFF_STAGE : INSIDE.left + 2,
  maxX: INSIDE.right - 2,
}));

/** A room from the ceiling of its top storey to the front of the floor of its bottom one. */
function room(x0: number, x1: number, top: number, bottom: number, role: VmRole): Room {
  const y = band(top).ceil;
  return { x: x0, y, w: x1 - x0, h: band(bottom).front - y, blurb: VM_BLURBS[role] };
}

const ROOMS: Readonly<Record<VmRole, Room>> = {
  ci: room(INSIDE.left, SHAFT_WALL, FLOOR.rookieBay, FLOOR.rookieBay, 'ci'),
  data: room(INSIDE.left, PARTITION_X, FLOOR.hangar, FLOOR.hangar, 'data'),
  deploy: room(PARTITION_X, SHAFT_WALL, FLOOR.hangar, FLOOR.hangar, 'deploy'),
  compute: room(INSIDE.left, SHAFT_WALL, FLOOR.ops2, FLOOR.gate, 'compute'),
};

/** Six slots across a storey, left of the lift. */
const slotX = (i: number): number => INSIDE.left + i * SLOT;

const watchStations = [FLOOR.ops2, FLOOR.ops1].flatMap((floor) =>
  [0, 1, 2, 3, 4, 5].map((i) => seat('watch', slotX(i), floor)),
);

const middleOf = ({ x, w }: { x: number; w: number }): number => x + w / 2;

/**
 * Index order matters, and matches the HQ's: the stage reports busy spots by index, and the HQ's
 * dressing (the brew station's steam, the swinging bag, the studied globe) reads them by the HQ's kinds.
 */
const BREAK_SPOTS: readonly BreakSpot[] = [
  { x: BREW.rect.x + 7, floor: FLOOR.command, kind: 'brew' },
  { x: BREW.rect.x + 19, floor: FLOOR.command, kind: 'brew' },
  ...[7, 20, 33].map((dx): BreakSpot => ({ x: COUCH.x + dx, floor: FLOOR.gate, kind: 'couch', sitY: COUCH.base - 3 })),
  { x: BAG_SPOT_X, floor: FLOOR.rookieBay, kind: 'bag' },
  { x: middleOf(HOLO_PEDESTAL), floor: FLOOR.gate, kind: 'holo' },
  { x: AXIS, floor: FLOOR.command, kind: 'trophy' },
];

export const SPIRE_LAYOUT: Layout = {
  width: WIDTH,
  height: HEIGHT,
  floors: FLOORS,
  liftX: LIFT_X,
  entrance: { x: OFF_STAGE, floor: FLOOR.gate },
  rooms: ROOMS,
  homes: {
    worker: watchStations,
    pod: [1, 2, 3].map((i) => seat('bench', slotX(i), FLOOR.rookieBay)),
    greeter: [seat('dispatch', slotX(2), FLOOR.gate)],
    guard: [post('gate', slotX(0), FLOOR.gate), post('gate', slotX(1), FLOOR.gate)],
    checker: [post('medic', slotX(3), FLOOR.gate)],
    keeper: [seat('archive', PGSQL.rect.x + PGSQL.rect.w, FLOOR.hangar)],
    courier: [post('hangar', PARTITION_X + 4, FLOOR.hangar)],
    wrangler: [post('drill', slotX(0), FLOOR.rookieBay)],
    // In the founders' order: the JARVIS remote's dock, then Paul's console and Dhruv's, either side of the orb above.
    founder: [
      post('dock', 150, FLOOR.command),
      seat('founder', AXIS - 15 - SLOT, FLOOR.command),
      seat('founder', AXIS + 15, FLOOR.command),
    ],
  },
  breakSpots: BREAK_SPOTS,
  // In front of the two lockers: PostgreSQL, then MySQL.
  stores: [PGSQL, MYSQL].map(({ rect }) => ({ x: middleOf(rect), floor: FLOOR.hangar })),
  vault: { x: middleOf(SILO), floor: FLOOR.sublevel },
  // The suit-up tube by the lift.
  podSpawn: { x: TUBE.rect.x + 6, floor: FLOOR.rookieBay },
};
