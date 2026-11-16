import type { Painter } from '../../contract/painter.ts';
import { FLOOR_BANDS } from './floor-bands.ts';
import { pen } from './pen.ts';

/**
 * A gap in a wall at the point where a floor's walk line crosses it. The Engine lets people walk
 * straight along `walkY`, so every wall on that line needs an opening they can fit through
 * (a person is about 12 px wide and 22 px tall; the opening is 32 px).
 */
export interface Doorway {
  x: number;
  w: number;
  floor: number;
  /** Floor colour inside the opening, matched to what lies either side. */
  floorColour: string;
}

export const DOOR_HEIGHT = 32;

const UPSTAIRS_FLOOR = '#a8794f';
const LOBBY_FLOOR = '#6b6880';
const PASSAGE = '#4a4560';
const FRAME = '#2a2533';

/** The lift shaft's walls, either side, and the two partitions between the upstairs rooms. */
export const DOORWAYS: readonly Doorway[] = [
  { x: 140, w: 4, floor: 1, floorColour: UPSTAIRS_FLOOR },
  { x: 270, w: 4, floor: 1, floorColour: UPSTAIRS_FLOOR },
  { x: 442, w: 4, floor: 1, floorColour: LOBBY_FLOOR },
  { x: 470, w: 4, floor: 1, floorColour: LOBBY_FLOOR },
  { x: 442, w: 4, floor: 0, floorColour: LOBBY_FLOOR },
  { x: 470, w: 4, floor: 0, floorColour: LOBBY_FLOOR },
];

/** The lift lobby: the shaft is a void, so each floor gets a landing across it. */
export const LIFT_SHAFT = { x: 446, w: 24 } as const;

function paintDoorway(painter: Painter, door: Doorway): void {
  const { R } = pen(painter);
  const band = FLOOR_BANDS[door.floor];
  if (!band) return;
  const top = band.front - DOOR_HEIGHT;
  R(PASSAGE, door.x, top, door.w, band.back - top);
  R(door.floorColour, door.x, band.back, door.w, band.front - band.back);
  R(FRAME, door.x - 1, top - 2, door.w + 2, 2);
  R(FRAME, door.x - 1, top, 1, band.front - top);
  R(FRAME, door.x + door.w, top, 1, band.front - top);
}

function paintLanding(painter: Painter, floor: number): void {
  const { R } = pen(painter);
  const band = FLOOR_BANDS[floor];
  if (!band) return;
  R(LOBBY_FLOOR, LIFT_SHAFT.x, band.back, LIFT_SHAFT.w, band.front - band.back);
  R('#5a566f', LIFT_SHAFT.x, band.back + 8, LIFT_SHAFT.w, 1);
  R('#8d8aa0', LIFT_SHAFT.x, band.back, LIFT_SHAFT.w, 1);
}

export function paintDoorways(painter: Painter): void {
  FLOOR_BANDS.forEach((_, floor) => paintLanding(painter, floor));
  for (const door of DOORWAYS) paintDoorway(painter, door);
}
