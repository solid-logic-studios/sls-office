import type { VmRole } from '../../contract/snapshot.ts';
import type { BreakSpot, Floor, Layout, Room } from '../../contract/theme.ts';
import { VM_BLURBS } from '../office/rooms.ts';
import { MYSQL_CABINET, POSTGRES_CABINET, VAULT } from './boards.ts';
import { FLOOR, HEIGHT, INSIDE, LIFT_X, SHAFT, SLOT, STOREYS, WIDTH, band } from './geometry.ts';
import { desk, post } from './places.ts';

/** Everyone walks the whole storey; the lobby also reaches the street off stage to the left. */
const FLOORS: readonly Floor[] = Array.from({ length: STOREYS }, (_, floor) => ({
  walkY: band(floor).walk,
  minX: floor === FLOOR.lobby ? -12 : INSIDE.left + 2,
  maxX: INSIDE.right - 2,
}));

/** Where the data room ends and the deploy room starts, on storey 3. */
export const PARTITION_X = 126;

/** A room from the ceiling of its top storey to the front of the floor of its bottom one, left of the lift. */
function room(x: number, w: number, top: number, bottom: number, role: VmRole): Room {
  const y = band(top).ceil;
  return { x, y, w, h: band(bottom).front - y, blurb: VM_BLURBS[role] };
}

const ROOMS: Readonly<Record<VmRole, Room>> = {
  ci: room(INSIDE.left, SHAFT.x - INSIDE.left, FLOOR.storey4, FLOOR.storey4, 'ci'),
  data: room(INSIDE.left, PARTITION_X - INSIDE.left, FLOOR.storey3, FLOOR.storey3, 'data'),
  deploy: room(PARTITION_X, SHAFT.x - PARTITION_X, FLOOR.storey3, FLOOR.storey3, 'deploy'),
  compute: room(INSIDE.left, SHAFT.x - INSIDE.left, FLOOR.storey2, FLOOR.lobby, 'compute'),
};

/** Six slots across each storey, left of the lift. */
const slotX = (i: number): number => INSIDE.left + i * SLOT;

const workerDesks = [FLOOR.storey1, FLOOR.storey2].flatMap((floor) =>
  [0, 1, 2, 3, 4, 5].map((i) => desk('worker', slotX(i), floor)),
);

/** The gap between the third and fourth desks, where a skinny cooler and a pot plant stand. */
export const DESK_GAP_X = slotX(3);

/** Index order matters: the stage reports busy spots by index. */
const BREAK_SPOTS: readonly BreakSpot[] = [
  { x: 135, floor: FLOOR.storey5, kind: 'coffee' },
  { x: DESK_GAP_X, floor: FLOOR.storey1, kind: 'cooler' },
  { x: DESK_GAP_X, floor: FLOOR.storey2, kind: 'plant' },
];

export const TOWER_LAYOUT: Layout = {
  width: WIDTH,
  height: HEIGHT,
  floors: FLOORS,
  liftX: LIFT_X,
  entrance: { x: -12, floor: FLOOR.lobby },
  rooms: ROOMS,
  homes: {
    worker: workerDesks,
    pod: [1, 2, 3].map((i) => desk('pod', slotX(i), FLOOR.storey4)),
    greeter: [desk('greeter', 68, FLOOR.lobby)],
    guard: [post(slotX(0), FLOOR.lobby), post(slotX(1), FLOOR.lobby)],
    checker: [post(118, FLOOR.lobby)],
    keeper: [desk('keeper', slotX(1), FLOOR.storey3)],
    courier: [post(PARTITION_X + 4, FLOOR.storey3)],
    wrangler: [post(slotX(0), FLOOR.storey4)],
    founder: [desk('founder', 10, FLOOR.storey5), desk('founder', 44, FLOOR.storey5)],
  },
  breakSpots: BREAK_SPOTS,
  // In front of the PostgreSQL cabinet, then the MySQL cabinet.
  stores: [POSTGRES_CABINET, MYSQL_CABINET].map(({ x, w }) => ({ x: x + w / 2, floor: FLOOR.storey3 })),
  vault: { x: VAULT.x + VAULT.w / 2, floor: FLOOR.basement },
  podSpawn: { x: 170, floor: FLOOR.storey4 },
};
