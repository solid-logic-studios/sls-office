import type { Painter } from '../../contract/painter.ts';
import type { DecorFn } from '../../contract/theme.ts';
import { wave } from '../hq/kit.ts';
import { AMBER, CYAN, HULL, INK, STEEL, UNLIT } from '../hq/palette.ts';
import { pen } from '../shared/pen.ts';
import { DOOR_HEIGHT, FLOOR, SHAFT, STOREYS, band } from './geometry.ts';

/**
 * The HQ's lift car (`hq/lift.ts`) in a seven-storey shaft. The Engine reports the car as `lift`:
 * the walk line it is at (`y`), whether its doors are open and the floors with someone waiting
 * (`calls`). The car is drawn wherever `y` is, as tall as the doorways, standing on the front edge
 * of the floor it is level with. It is lit cyan while it travels, stands with its doors open or anyone
 * waits or rides (`liftInUse`), and sits dark otherwise. While its doors are open a gap shows in the
 * car and in the landing doors of the floor it is level with. A landing lamp is amber while someone
 * waits there and cyan otherwise. Two cables hang from the top of the shaft and shimmer while it
 * travels, and an amber pair blinks on its roof. The riders are drawn over the car by the Engine.
 */

const CAR = { w: 14, h: DOOR_HEIGHT } as const;
const CAR_X = SHAFT.x + (SHAFT.w - CAR.w) / 2;
const DOOR_GAP = 3;

export const LIFT_COLOURS = {
  frame: STEEL.base,
  leaf: STEEL.dark,
  seam: INK,
  gap: HULL.dark,
  cable: STEEL.base,
  shimmer: STEEL.shine,
  lamp: { call: AMBER.glow, idle: CYAN.base },
  lit: { frame: CYAN.bright, inside: CYAN.deep },
  indicator: AMBER.base,
} as const;

const CABLES = [CAR_X + 3, CAR_X + CAR.w - 4] as const;
const SHAFT_TOP = band(FLOOR.command).ceil;

/** From a storey's walk line down to the car's floor, which is the storey's front edge. */
const FLOOR_DROP = band(FLOOR.gate).front - band(FLOOR.gate).walk;

/** The car's top when it is level with the walk line `walkY`. */
export const carTopAt = (walkY: number): number => walkY + FLOOR_DROP - CAR.h;

/** The floor whose landing the car is nearest to. */
function nearestFloor(walkY: number): number {
  let nearest: number = FLOOR.gate;
  for (let floor = 0; floor < STOREYS; floor++) {
    if (Math.abs(band(floor).walk - walkY) < Math.abs(band(nearest).walk - walkY)) nearest = floor;
  }
  return nearest;
}

const gap = (painter: Painter, top: number): void =>
  pen(painter).R(LIFT_COLOURS.gap, CAR_X + CAR.w / 2 - DOOR_GAP, top, DOOR_GAP * 2, CAR.h);

function shutDoors(painter: Painter, top: number): void {
  const { R } = pen(painter);
  R(LIFT_COLOURS.leaf, CAR_X, top, CAR.w, CAR.h);
  R(LIFT_COLOURS.seam, CAR_X + CAR.w / 2 - 1, top, 1, CAR.h);
}

/** Each landing: shut doors, a frame and the call lamp above. The doors part on the car's floor. */
function paintLandings(painter: Painter, doorsOpen: boolean, atFloor: number, calls: ReadonlySet<number>): void {
  const { R } = pen(painter);
  for (let floor = 0; floor < STOREYS; floor++) {
    const top = carTopAt(band(floor).walk);
    R(LIFT_COLOURS.frame, CAR_X - 1, top - 1, CAR.w + 2, CAR.h + 1);
    shutDoors(painter, top);
    if (doorsOpen && floor === atFloor) gap(painter, top);
    R(HULL.dark, CAR_X + CAR.w / 2 - 3, top - 5, 6, 3);
    R(calls.has(floor) ? LIFT_COLOURS.lamp.call : LIFT_COLOURS.lamp.idle, CAR_X + CAR.w / 2 - 2, top - 4, 4, 1);
  }
}

function paintCables(painter: Painter, carTop: number, moving: boolean, now: number): void {
  const { R } = pen(painter);
  for (const x of CABLES) {
    R(LIFT_COLOURS.cable, x, SHAFT_TOP, 1, carTop - SHAFT_TOP);
    if (!moving) continue;
    for (let y = SHAFT_TOP + Math.floor((now * 40) % 8); y < carTop; y += 8) R(LIFT_COLOURS.shimmer, x, y, 1, 2);
  }
}

export const paintLift: DecorFn = (painter, { now, liftInUse, lift }) => {
  const { R } = pen(painter);
  const top = carTopAt(lift.y);
  paintLandings(painter, lift.doorsOpen, nearestFloor(lift.y), lift.calls);
  paintCables(painter, top, lift.moving, now);
  const lit = lift.moving || lift.doorsOpen || liftInUse;
  R(lit ? LIFT_COLOURS.lit.frame : LIFT_COLOURS.frame, CAR_X - 1, top - 1, CAR.w + 2, CAR.h + 1);
  R(lit ? LIFT_COLOURS.lit.inside : UNLIT, CAR_X, top, CAR.w, CAR.h);
  if (lift.doorsOpen) {
    R(CYAN.base, CAR_X + 1, top + 1, CAR.w - 2, 2);
    gap(painter, top);
  } else {
    shutDoors(painter, top);
  }
  if (lift.moving) {
    const blink = wave(now, 0.6) > 0.5;
    R(blink ? LIFT_COLOURS.indicator : AMBER.ember, CAR_X + CAR.w / 2 - 3, top - 3, 2, 2);
    R(blink ? AMBER.ember : LIFT_COLOURS.indicator, CAR_X + CAR.w / 2 + 1, top - 3, 2, 2);
  }
};
