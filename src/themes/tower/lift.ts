import type { Painter } from '../../contract/painter.ts';
import type { DecorFn } from '../../contract/theme.ts';
import { pen } from '../office/pen.ts';
import { FLOOR, FLOOR_NAMES, SHAFT, STOREYS, band, storeyTop } from './geometry.ts';

/**
 * The lift: a shaft at the right of every storey, a landing with doors, a lamp and the floor's
 * name on each, and the one car the Engine runs. The Engine reports the car as `lift`: the walk
 * line it is at (`y`), whether its doors are open and the floors with someone waiting (`calls`).
 * The car is drawn wherever `y` is. It is lit while it travels, stands with its doors open or anyone
 * waits or rides (`liftInUse`), and shows only a shut gold cap when idle with nobody about. While its doors are open a gap shows in the car and in
 * the landing doors of the floor it stands at; the other landings stay shut. A landing's lamp is
 * amber while someone waits there and green otherwise. The cables run only while the car travels (`moving`).
 * The riders are drawn over the car by the Engine.
 */

const CAR = { w: 16, h: 24 } as const;
const CAR_X = SHAFT.x + (SHAFT.w - CAR.w) / 2;

const DOOR_GAP = 4;

const LAMP = { idle: '#5fcf7a', busy: '#f2c230' } as const;

/** From a floor's walk line up to the top of the car standing at that floor: the same on every floor. */
export const CAR_TOP_OFFSET = band(FLOOR.basement).walk - band(FLOOR.basement).back + CAR.h;

/** The car's top when it stands at the walk line `walkY`. */
export const carTopAt = (walkY: number): number => walkY - CAR_TOP_OFFSET;

/** The car's top when it stands at a floor's landing. */
const carTop = (floor: number): number => carTopAt(band(floor).walk);

/** The floor whose landing the car is nearest to. */
function nearestFloor(walkY: number): number {
  let nearest: number = FLOOR.lobby;
  for (let floor = 0; floor < STOREYS; floor++) {
    if (Math.abs(band(floor).walk - walkY) < Math.abs(band(nearest).walk - walkY)) nearest = floor;
  }
  return nearest;
}

/** The dark gap down the middle of a pair of doors whose top is at `top`. */
const gap = (painter: Painter, top: number): void =>
  pen(painter).R('#2a2533', CAR_X + CAR.w / 2 - DOOR_GAP, top, DOOR_GAP * 2, CAR.h);

export const paintLift: DecorFn = (painter, { now, liftInUse, lift }) => {
  const { R, T } = pen(painter);
  const top = storeyTop(STOREYS - 1);
  const bottom = band(FLOOR.basement).front;
  const atFloor = nearestFloor(lift.y);
  // The shaft and its cables.
  R('#1c1926', SHAFT.x, top, SHAFT.w, bottom - top);
  for (const x of [SHAFT.x + 5, SHAFT.x + SHAFT.w - 6]) R('#2c2838', x, top, 1, bottom - top);
  if (lift.moving) {
    for (let y = top + Math.floor((now * 40) % 8); y < bottom; y += 8) R('#55506a', SHAFT.x + 5, y, 1, 2);
  }
  for (let floor = 0; floor < STOREYS; floor++) {
    const b = band(floor);
    // Landing, door frame and doors. The doors open only where the car stands, while its doors are open.
    R('#6b6880', SHAFT.x, b.back, SHAFT.w, b.front - b.back);
    R('#8d8aa0', SHAFT.x, b.back, SHAFT.w, 1);
    R('#55506a', CAR_X - 1, carTop(floor) - 1, CAR.w + 2, CAR.h + 1);
    R('#8d94a0', CAR_X, carTop(floor), CAR.w, CAR.h);
    if (lift.doorsOpen && floor === atFloor) gap(painter, carTop(floor));
    R(lift.calls.has(floor) ? LAMP.busy : LAMP.idle, CAR_X + CAR.w / 2 - 2, carTop(floor) - 4, 4, 1);
    T(FLOOR_NAMES[floor] ?? '', SHAFT.x + SHAFT.w / 2, b.ceil + 8, '#c9c3d6', 'centre');
  }
  // The car.
  const y = carTopAt(lift.y);
  if (!(lift.moving || lift.doorsOpen || liftInUse)) {
    R('#c9a14a', CAR_X, y, CAR.w, 2);
    return;
  }
  R('#c9a14a', CAR_X - 1, y - 1, CAR.w + 2, CAR.h + 2);
  R('#fff2c4', CAR_X, y, CAR.w, CAR.h);
  if (lift.doorsOpen) gap(painter, y);
};
