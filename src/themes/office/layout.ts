import type { Floor, Layout, Place } from '../../contract/theme.ts';
import { BREAK_SPOTS } from './break-spots.ts';
import {
  archiveDeskArt,
  founderDeskArt,
  podBenchArt,
  receptionDeskArt,
  standingPost,
  workerDeskArt,
} from './places.ts';
import { ROOMS } from './rooms.ts';

export const FLOORS: readonly Floor[] = [
  { walkY: 242, minX: -12, maxX: 600 },
  { walkY: 134, minX: 14, maxX: 562 },
];

const [GROUND, UPSTAIRS] = [0, 1];
const walkY = (floor: number): number => FLOORS[floor]?.walkY ?? 0;

const WORKER_DESKS = 12;

const workerDesks: Place[] = Array.from({ length: WORKER_DESKS }, (_, i) => {
  const x = 88 + i * 29;
  return { x, w: 24, h: 21, baseY: 236, floor: GROUND, seat: { x: x + 14, y: 233 }, art: workerDeskArt };
});

const podBenches: Place[] = [44, 76, 108].map((x) => ({
  x,
  w: 24,
  h: 21,
  baseY: 128,
  floor: UPSTAIRS,
  seat: { x: x + 12, y: 125 },
  art: podBenchArt,
}));

const founderDesks: Place[] = [280, 314].map((x) => ({
  x,
  w: 30,
  h: 21,
  baseY: 128,
  floor: UPSTAIRS,
  seat: { x: x + 16, y: 125 },
  art: founderDeskArt,
}));

export const OFFICE_LAYOUT: Layout = {
  width: 660,
  height: 270,
  floors: FLOORS,
  liftX: 458,
  entrance: { x: -12, floor: GROUND },
  rooms: ROOMS,
  homes: {
    worker: workerDesks,
    pod: podBenches,
    greeter: [{ x: 40, w: 46, h: 21, baseY: 236, floor: GROUND, seat: { x: 66, y: 233 }, art: receptionDeskArt }],
    guard: [standingPost(20, GROUND, walkY(GROUND)), standingPost(31, GROUND, walkY(GROUND))],
    checker: [standingPost(74, GROUND, walkY(GROUND))],
    keeper: [{ x: 186, w: 24, h: 21, baseY: 128, floor: UPSTAIRS, seat: { x: 200, y: 125 }, art: archiveDeskArt }],
    courier: [standingPost(508, GROUND, walkY(GROUND))],
    wrangler: [standingPost(27, UPSTAIRS, walkY(UPSTAIRS))],
    founder: founderDesks,
  },
  breakSpots: BREAK_SPOTS,
  // The PostgreSQL cabinet, then the MySQL cabinet.
  stores: [
    { x: 165, floor: UPSTAIRS },
    { x: 233, floor: UPSTAIRS },
  ],
  vault: { x: 596, floor: GROUND },
  podSpawn: { x: 20, floor: UPSTAIRS },
};
