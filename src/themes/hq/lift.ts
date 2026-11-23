import type { Painter } from '../../contract/painter.ts';
import type { DecorFn } from '../../contract/theme.ts';
import { pen } from '../shared/pen.ts';
import { BANDS, DECK, SHAFT, type DeckBand } from './geometry.ts';
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
 */

const CAR = { w: 16, h: DOOR_HEIGHT } as const;
const CAR_X = SHAFT.x + (SHAFT.w - CAR.w) / 2;
const DOOR_GAP = 3;

const COLOURS = {
  frame: STEEL.base,
  leaf: STEEL.dark,
  seam: INK,
  gap: HULL.dark,
  cable: STEEL.base,
  shimmer: STEEL.shine,
  lamp: { call: AMBER.glow, idle: CYAN.base },
  indicator: AMBER.base,
} as const;

/** The two cables' x positions. */
const CABLES = [CAR_X + 4, CAR_X + CAR.w - 5] as const;

/** The top of the shaft, where the cables hang from. */
const SHAFT_TOP = BANDS[DECK.upper].ceil;

/** From a deck's walk line down to the car's floor, which is the deck's front edge. */
const FLOOR_DROP = BANDS[DECK.ground].front - BANDS[DECK.ground].walk;

/** The car's top when it is level with the walk line `walkY`. */
export const carTopAt = (walkY: number): number => walkY + FLOOR_DROP - CAR.h;

const LANDING_TOP = (band: DeckBand): number => carTopAt(band.walk);

/** The deck whose landing the car is nearest to. */
function nearestDeck(walkY: number): DeckBand {
  const [ground, upper] = BANDS;
  return Math.abs(upper.walk - walkY) < Math.abs(ground.walk - walkY) ? upper : ground;
}

/** The dark gap down the middle of a pair of doors whose top is at `top`. */
const gap = (painter: Painter, top: number): void =>
  pen(painter).R(COLOURS.gap, CAR_X + CAR.w / 2 - DOOR_GAP, top, DOOR_GAP * 2, CAR.h);

/** A pair of shut doors with a seam, whose top is at `top`. */
function shutDoors(painter: Painter, top: number): void {
  const { R } = pen(painter);
  R(COLOURS.leaf, CAR_X, top, CAR.w, CAR.h);
  R(COLOURS.seam, CAR_X + CAR.w / 2 - 1, top, 1, CAR.h);
}

/** Each landing: shut doors, a frame and the call lamp above. The doors part on the car's floor. */
function paintLandings(painter: Painter, doorsOpen: boolean, atDeck: DeckBand, calls: ReadonlySet<number>): void {
  const { R } = pen(painter);
  BANDS.forEach((band, floor) => {
    const top = LANDING_TOP(band);
    R(COLOURS.frame, CAR_X - 1, top - 1, CAR.w + 2, CAR.h + 1);
    shutDoors(painter, top);
    if (doorsOpen && band === atDeck) gap(painter, top);
    R(HULL.dark, CAR_X + CAR.w / 2 - 3, top - 5, 6, 3);
    R(calls.has(floor) ? COLOURS.lamp.call : COLOURS.lamp.idle, CAR_X + CAR.w / 2 - 2, top - 4, 4, 1);
  });
}

/** The cables from the top of the shaft down to the car's roof, with a bright dash running while it travels. */
function paintCables(painter: Painter, carTop: number, moving: boolean, now: number): void {
  const { R } = pen(painter);
  for (const x of CABLES) {
    R(COLOURS.cable, x, SHAFT_TOP, 1, carTop - SHAFT_TOP);
    if (!moving) continue;
    for (let y = SHAFT_TOP + Math.floor((now * 40) % 8); y < carTop; y += 8) R(COLOURS.shimmer, x, y, 1, 2);
  }
}

export const paintLift: DecorFn = (painter, { now, liftInUse, lift }) => {
  const { R } = pen(painter);
  const top = carTopAt(lift.y);
  paintLandings(painter, lift.doorsOpen, nearestDeck(lift.y), lift.calls);
  paintCables(painter, top, lift.moving, now);
  // The car: a frame, the doors (or a lit interior behind a gap), and the roof indicator.
  const lit = lift.moving || lift.doorsOpen || liftInUse;
  R(lit ? CYAN.bright : COLOURS.frame, CAR_X - 1, top - 1, CAR.w + 2, CAR.h + 1);
  R(lit ? CYAN.deep : UNLIT, CAR_X, top, CAR.w, CAR.h);
  if (lift.doorsOpen) {
    R(CYAN.base, CAR_X + 1, top + 1, CAR.w - 2, 2);
    gap(painter, top);
  } else {
    shutDoors(painter, top);
  }
  if (lift.moving) {
    const blink = wave(now, 0.6) > 0.5;
    R(blink ? COLOURS.indicator : AMBER.ember, CAR_X + CAR.w / 2 - 3, top - 3, 2, 2);
    R(blink ? AMBER.ember : COLOURS.indicator, CAR_X + CAR.w / 2 + 1, top - 3, 2, 2);
  }
};

/** Painted in the back layer, after the structure, in this order. */
export const LIFT_BACK: readonly DecorFn[] = [paintLift];
