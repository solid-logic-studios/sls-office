import type { Painter } from '../../contract/painter.ts';
import type { DecorFn } from '../../contract/theme.ts';
import { pen } from '../shared/pen.ts';
import { BANDS, DECK, SHAFT } from './geometry.ts';
import { wave } from './kit.ts';
import { AMBER, CYAN, HULL, INK, STEEL, UNLIT } from './palette.ts';
import { DOOR_HEIGHT } from './shell.ts';

/**
 * The lift car (docs/design/hq-theme.md, section 11, slice 7). The Engine reports the car as `lift`:
 * the walk line it is at (`y`), whether its doors are open and the floors with someone waiting
 * (`calls`). The car is drawn wherever `y` is, as tall as the doorways, standing on the front edge of
 * the floor it is level with. It is lit cyan while it travels, stands with its doors open or anyone
 * waits or rides (`liftInUse`), and sits dark otherwise. While its doors are open a gap shows in the
 * car and in the landing doors of the floor it is level with. A landing lamp is amber while someone
 * waits there and cyan otherwise. Two cables hang from the top of the shaft to the car and shimmer
 * while it travels, and an amber pair blinks on its roof. The riders are drawn over the car by the
 * Engine, so the interior is left clear.
 *
 * A Theme builds its lift with `liftCar` and a `LiftSpec`, so the HQ's two decks and the Spire's seven
 * storeys share the art.
 */

/** Where a lift runs: its shaft, its car and the floors it serves. */
export interface LiftSpec {
  shaft: { x: number; w: number };
  /** The car, as tall as the doorways and centred in the shaft. */
  car: { w: number; h: number };
  /** How far in from the car's sides its two cables hang. */
  cableInset: number;
  /** The top of the shaft, where the cables hang from. */
  top: number;
  /** The walk lines of the floors it serves, by floor index. */
  walks: readonly number[];
  /** From a walk line down to the car's floor, which is the front edge of the floor: the same on every floor. */
  floorDrop: number;
}

/** A lift: its art, and where its car's top is when it is level with a walk line. */
export interface LiftCar {
  paint: DecorFn;
  carTopAt(walkY: number): number;
}

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

export function liftCar({ shaft, car, cableInset, top: shaftTop, walks, floorDrop }: LiftSpec): LiftCar {
  const carX = shaft.x + (shaft.w - car.w) / 2;
  const cables = [carX + cableInset, carX + car.w - cableInset - 1] as const;

  /** The car's top when it is level with the walk line `walkY`. */
  const carTopAt = (walkY: number): number => walkY + floorDrop - car.h;

  /** The floor whose landing the car is nearest to (the lower, on a tie). */
  function nearestFloor(walkY: number): number {
    let nearest = -1;
    let distance = Infinity;
    walks.forEach((walk, floor) => {
      if (Math.abs(walk - walkY) >= distance) return;
      nearest = floor;
      distance = Math.abs(walk - walkY);
    });
    return nearest;
  }

  /** The dark gap down the middle of a pair of doors whose top is at `top`. */
  const gap = (painter: Painter, top: number): void =>
    pen(painter).R(LIFT_COLOURS.gap, carX + car.w / 2 - DOOR_GAP, top, DOOR_GAP * 2, car.h);

  /** A pair of shut doors with a seam, whose top is at `top`. */
  function shutDoors(painter: Painter, top: number): void {
    const { R } = pen(painter);
    R(LIFT_COLOURS.leaf, carX, top, car.w, car.h);
    R(LIFT_COLOURS.seam, carX + car.w / 2 - 1, top, 1, car.h);
  }

  /** Each landing: shut doors, a frame and the call lamp above. The doors part on the car's floor. */
  function paintLandings(painter: Painter, doorsOpen: boolean, atFloor: number, calls: ReadonlySet<number>): void {
    const { R } = pen(painter);
    walks.forEach((walk, i) => {
      const top = carTopAt(walk);
      R(LIFT_COLOURS.frame, carX - 1, top - 1, car.w + 2, car.h + 1);
      shutDoors(painter, top);
      if (doorsOpen && i === atFloor) gap(painter, top);
      R(HULL.dark, carX + car.w / 2 - 3, top - 5, 6, 3);
      R(calls.has(i) ? LIFT_COLOURS.lamp.call : LIFT_COLOURS.lamp.idle, carX + car.w / 2 - 2, top - 4, 4, 1);
    });
  }

  /** The cables from the top of the shaft down to the car's roof, with a bright dash running while it travels. */
  function paintCables(painter: Painter, carTop: number, moving: boolean, now: number): void {
    const { R } = pen(painter);
    for (const x of cables) {
      R(LIFT_COLOURS.cable, x, shaftTop, 1, carTop - shaftTop);
      if (!moving) continue;
      for (let y = shaftTop + Math.floor((now * 40) % 8); y < carTop; y += 8) R(LIFT_COLOURS.shimmer, x, y, 1, 2);
    }
  }

  const paint: DecorFn = (painter, { now, liftInUse, lift }) => {
    const { R } = pen(painter);
    const top = carTopAt(lift.y);
    paintLandings(painter, lift.doorsOpen, nearestFloor(lift.y), lift.calls);
    paintCables(painter, top, lift.moving, now);
    // The car: a frame, the doors (or a lit interior behind a gap), and the roof indicator.
    const lit = lift.moving || lift.doorsOpen || liftInUse;
    R(lit ? LIFT_COLOURS.lit.frame : LIFT_COLOURS.frame, carX - 1, top - 1, car.w + 2, car.h + 1);
    R(lit ? LIFT_COLOURS.lit.inside : UNLIT, carX, top, car.w, car.h);
    if (lift.doorsOpen) {
      R(CYAN.base, carX + 1, top + 1, car.w - 2, 2);
      gap(painter, top);
    } else {
      shutDoors(painter, top);
    }
    if (lift.moving) {
      const blink = wave(now, 0.6) > 0.5;
      R(blink ? LIFT_COLOURS.indicator : AMBER.ember, carX + car.w / 2 - 3, top - 3, 2, 2);
      R(blink ? AMBER.ember : LIFT_COLOURS.indicator, carX + car.w / 2 + 1, top - 3, 2, 2);
    }
  };

  return { paint, carTopAt };
}

/** The HQ's lift: one shaft through both decks. */
export const HQ_LIFT = liftCar({
  shaft: SHAFT,
  car: { w: 16, h: DOOR_HEIGHT },
  cableInset: 4,
  top: BANDS[DECK.upper].ceil,
  walks: BANDS.map((band) => band.walk),
  floorDrop: BANDS[DECK.ground].front - BANDS[DECK.ground].walk,
});

/** Painted in the back layer, after the structure, in this order. */
export const LIFT_BACK: readonly DecorFn[] = [HQ_LIFT.paint];
