import type { DecorFn } from '../../contract/theme.ts';
import { pen } from '../office/pen.ts';
import { FLOOR, FLOOR_NAMES, SHAFT, STOREYS, band, storeyTop } from './geometry.ts';

/**
 * The lift: a shaft at the right of every storey, a landing with doors, a lamp and the floor's
 * name on each, and the car. The Engine only says whether anybody is riding, so the car is drawn
 * from that alone: parked in the lobby with its doors shut while idle, lit and sweeping the shaft
 * while in use (the rider is drawn over it), with every landing's lamp amber and doors twitching.
 */

const CAR = { w: 16, h: 24 } as const;
const CAR_X = SHAFT.x + (SHAFT.w - CAR.w) / 2;
/** Seconds for the moving car to sweep from the basement to the top storey. */
const SWEEP = 0.9;

const LAMP = { idle: '#5fcf7a', busy: '#f2c230' } as const;

/** The car's top when it stands at a floor's landing. */
const carTop = (floor: number): number => band(floor).back - CAR.h;

/** 0 to 1 and back, every `2 * SWEEP` seconds. */
const sweep = (now: number): number => {
  const t = (now / SWEEP) % 2;
  return t <= 1 ? t : 2 - t;
};

export const paintLift: DecorFn = (painter, { now, liftInUse }) => {
  const { R, T } = pen(painter);
  const top = storeyTop(STOREYS - 1);
  const bottom = band(FLOOR.basement).front;
  // The shaft and its cables.
  R('#1c1926', SHAFT.x, top, SHAFT.w, bottom - top);
  for (const x of [SHAFT.x + 5, SHAFT.x + SHAFT.w - 6]) R('#2c2838', x, top, 1, bottom - top);
  if (liftInUse) {
    for (let y = top + Math.floor((now * 40) % 8); y < bottom; y += 8) R('#55506a', SHAFT.x + 5, y, 1, 2);
  }
  for (let floor = 0; floor < STOREYS; floor++) {
    const b = band(floor);
    // Landing, door frame and doors. The doors twitch while the lift is in use.
    R('#6b6880', SHAFT.x, b.back, SHAFT.w, b.front - b.back);
    R('#8d8aa0', SHAFT.x, b.back, SHAFT.w, 1);
    R('#55506a', CAR_X - 1, carTop(floor) - 1, CAR.w + 2, CAR.h + 1);
    R('#8d94a0', CAR_X, carTop(floor), CAR.w, CAR.h);
    const gap = liftInUse ? 1 + (Math.floor(now * 4 + floor) % 3) : 0;
    R('#2a2533', CAR_X + CAR.w / 2 - gap - 0.5, carTop(floor), 1 + gap * 2, CAR.h);
    R(liftInUse ? LAMP.busy : LAMP.idle, CAR_X + CAR.w / 2 - 2, carTop(floor) - 4, 4, 1);
    T(FLOOR_NAMES[floor] ?? '', SHAFT.x + SHAFT.w / 2, b.ceil + 8, '#c9c3d6', 'centre');
  }
  // The car.
  const lobby = carTop(FLOOR.lobby);
  if (!liftInUse) {
    R('#c9a14a', CAR_X, lobby, CAR.w, 2);
    return;
  }
  const y = carTop(FLOOR.basement) + (carTop(STOREYS - 1) - carTop(FLOOR.basement)) * sweep(now);
  R('#c9a14a', CAR_X - 1, y - 1, CAR.w + 2, CAR.h + 2);
  R('#fff2c4', CAR_X, y, CAR.w, CAR.h);
};
