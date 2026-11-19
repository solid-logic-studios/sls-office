import type { DecorFn } from '../../contract/theme.ts';
import { pen } from '../office/pen.ts';
import { FLOOR, FLOOR_NAMES, SHAFT, STOREYS, band, storeyTop } from './geometry.ts';

/**
 * The lift: a shaft at the right of every storey, a landing with doors, a lamp and the floor's
 * name on each, and the car. The Engine reports the walk line the car stands at (`liftCarY`): it
 * follows the rider while anyone rides and stays where the last ride ended, and is `null` before
 * the first ride (the car waits in the lobby). In use the car is lit, with the cables moving and
 * every lamp amber, and the doors twitch on the landing the car is at; the rider is drawn over
 * the car by the Engine. Idle, the car stands shut at the floor it last stopped at.
 */

const CAR = { w: 16, h: 24 } as const;
const CAR_X = SHAFT.x + (SHAFT.w - CAR.w) / 2;

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

export const paintLift: DecorFn = (painter, { now, liftInUse, liftCarY }) => {
  const { R, T } = pen(painter);
  const top = storeyTop(STOREYS - 1);
  const bottom = band(FLOOR.basement).front;
  const carY = liftCarY ?? band(FLOOR.lobby).walk;
  const atFloor = nearestFloor(carY);
  // The shaft and its cables.
  R('#1c1926', SHAFT.x, top, SHAFT.w, bottom - top);
  for (const x of [SHAFT.x + 5, SHAFT.x + SHAFT.w - 6]) R('#2c2838', x, top, 1, bottom - top);
  if (liftInUse) {
    for (let y = top + Math.floor((now * 40) % 8); y < bottom; y += 8) R('#55506a', SHAFT.x + 5, y, 1, 2);
  }
  for (let floor = 0; floor < STOREYS; floor++) {
    const b = band(floor);
    // Landing, door frame and doors. The doors twitch only where the car is, while the lift is in use.
    R('#6b6880', SHAFT.x, b.back, SHAFT.w, b.front - b.back);
    R('#8d8aa0', SHAFT.x, b.back, SHAFT.w, 1);
    R('#55506a', CAR_X - 1, carTop(floor) - 1, CAR.w + 2, CAR.h + 1);
    R('#8d94a0', CAR_X, carTop(floor), CAR.w, CAR.h);
    const gap = liftInUse && floor === atFloor ? 1 + (Math.floor(now * 4) % 3) : 0;
    R('#2a2533', CAR_X + CAR.w / 2 - gap - 0.5, carTop(floor), 1 + gap * 2, CAR.h);
    R(liftInUse ? LAMP.busy : LAMP.idle, CAR_X + CAR.w / 2 - 2, carTop(floor) - 4, 4, 1);
    T(FLOOR_NAMES[floor] ?? '', SHAFT.x + SHAFT.w / 2, b.ceil + 8, '#c9c3d6', 'centre');
  }
  // The car.
  const y = carTopAt(carY);
  if (!liftInUse) {
    R('#c9a14a', CAR_X, y, CAR.w, 2);
    return;
  }
  R('#c9a14a', CAR_X - 1, y - 1, CAR.w + 2, CAR.h + 2);
  R('#fff2c4', CAR_X, y, CAR.w, CAR.h);
};
