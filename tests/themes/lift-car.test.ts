import { describe, expect, it } from 'vitest';
import type { StageView } from '../../src/contract/theme.ts';
import { BANDS, DECK, GROUND_Y, SHAFT as HQ_SHAFT } from '../../src/themes/hq/geometry.ts';
import { hqTheme } from '../../src/themes/hq/index.ts';
import { HQ_LIFT, LIFT_COLOURS, type LiftCar } from '../../src/themes/hq/lift.ts';
import { AMBER, CYAN, HULL } from '../../src/themes/hq/palette.ts';
import { FLOOR, SHAFT as SPIRE_SHAFT, STOREYS, band } from '../../src/themes/spire/geometry.ts';
import { spireTheme } from '../../src/themes/spire/index.ts';
import { SPIRE_LIFT } from '../../src/themes/spire/lift.ts';
import { RecordingPainter } from '../support/recording-painter.ts';
import { stage as baseStage } from '../support/stage.ts';

/** The HQ's lift car, built by `liftCar` for the HQ's two decks and the Spire's seven storeys. */

const CAR_H = 32;

interface Case {
  lift: LiftCar;
  shaft: { x: number; w: number };
  /** The top of the shaft and the bottom of the lowest landing. */
  top: number;
  bottom: number;
  /** Every floor's walk line and front edge, by floor index. */
  floors: readonly { walk: number; front: number }[];
  /** The car's frame: two wider than the car. */
  frameW: number;
}

const CASES: readonly (readonly [string, Case])[] = [
  [
    'HQ',
    {
      lift: HQ_LIFT,
      shaft: HQ_SHAFT,
      top: BANDS[DECK.upper].ceil,
      bottom: GROUND_Y,
      floors: BANDS,
      frameW: 18,
    },
  ],
  [
    'Spire',
    {
      lift: SPIRE_LIFT,
      shaft: SPIRE_SHAFT,
      top: band(FLOOR.command).ceil,
      bottom: band(FLOOR.sublevel).front,
      floors: Array.from({ length: STOREYS }, (_, floor) => band(floor)),
      frameW: 16,
    },
  ],
];

const carAt = (y: number, over: Partial<StageView['lift']> = {}): StageView['lift'] => ({
  y,
  moving: false,
  doorsOpen: false,
  calls: new Set(),
  ...over,
});

const stage = (lift: StageView['lift'], over: Partial<StageView> = {}): StageView =>
  baseStage({
    now: 3.1,
    host: null,
    vms: [],
    findings: { ok: 0, warn: 0, crit: 0 },
    lift,
    ...over,
  });

it('stands in both Themes, after their structure', () => {
  expect(hqTheme.decor.back).toContain(HQ_LIFT.paint);
  expect(spireTheme.decor.back).toContain(SPIRE_LIFT.paint);
});

describe.each(CASES)('the %s lift car', (_name, { lift: car, shaft, top, bottom, floors, frameW }) => {
  function paint(view: StageView): RecordingPainter {
    const painter = new RecordingPainter();
    car.paint(painter, view);
    return painter;
  }

  const walks = floors.map((floor) => floor.walk);
  const [lowest = 0, next = 0] = walks;
  const highest = walks[walks.length - 1] ?? 0;
  const between = (lowest + next) / 2;
  const frameOf = (view: StageView) => paint(view).rects.find((r) => r.colour === CYAN.bright && r.w === frameW);
  const gaps = (view: StageView) =>
    paint(view).rects.filter((r) => r.colour === HULL.dark && r.w === 6 && r.h === CAR_H);
  const lamps = (view: StageView) => paint(view).rects.filter((r) => r.w === 4 && r.h === 1);

  it('stands on the front edge of the floor it is level with, inside the shaft, on every floor and between', () => {
    for (const walkY of [...walks, between]) {
      const frame = frameOf(stage(carAt(walkY), { liftInUse: true }));
      expect(frame?.y).toBe(car.carTopAt(walkY) - 1);
      expect(frame!.x).toBeGreaterThanOrEqual(shaft.x);
      expect(frame!.x + frame!.w).toBeLessThanOrEqual(shaft.x + shaft.w);
      expect(frame!.y + frame!.h).toBeLessThanOrEqual(bottom);
    }
    for (const floor of floors) expect(car.carTopAt(floor.walk) + CAR_H).toBe(floor.front);
  });

  it('keeps every mark inside the shaft', () => {
    const everyCall = new Set(floors.map((_, i) => i));
    for (const walkY of [...walks, between]) {
      for (const lift of [carAt(walkY), carAt(walkY, { moving: true, doorsOpen: true, calls: everyCall })]) {
        for (const r of paint(stage(lift, { liftInUse: true })).rects) {
          expect(r.x).toBeGreaterThanOrEqual(shaft.x);
          expect(r.x + r.w).toBeLessThanOrEqual(shaft.x + shaft.w);
          expect(r.y).toBeGreaterThanOrEqual(top);
          expect(r.y + r.h).toBeLessThanOrEqual(bottom);
        }
      }
    }
  });

  it('lights while in use, travelling or open, and sits dark when idle', () => {
    expect(frameOf(stage(carAt(highest), { liftInUse: true }))).toBeDefined();
    expect(frameOf(stage(carAt(highest, { moving: true })))).toBeDefined();
    expect(frameOf(stage(carAt(highest, { doorsOpen: true })))).toBeDefined();
    expect(frameOf(stage(carAt(highest)))).toBeUndefined();
    expect(paint(stage(carAt(highest), { liftInUse: true })).rects).toContainEqual(
      expect.objectContaining({ colour: LIFT_COLOURS.lit.inside, y: car.carTopAt(highest), h: CAR_H }),
    );
  });

  describe('doors and lamps', () => {
    it('shows the car door gap only while the doors are open', () => {
      const open = gaps(stage(carAt(between, { doorsOpen: true })));
      expect(open.some((r) => r.y === car.carTopAt(between))).toBe(true);
      expect(gaps(stage(carAt(between)))).toHaveLength(0);
    });

    it('opens the landing doors only on the car floor', () => {
      floors.forEach(({ walk }, at) => {
        const tops = gaps(stage(carAt(walk, { doorsOpen: true }))).map((r) => r.y);
        expect(tops).toContain(car.carTopAt(walk));
        walks.forEach((other, floor) => {
          if (floor !== at) expect(tops).not.toContain(car.carTopAt(other));
        });
      });
    });

    it('lights a landing lamp amber only for floors with a call', () => {
      const called = new Set([floors.length - 1, ...(floors.length > 2 ? [2] : [])]);
      const lampAt = (walk: number, v: StageView) => lamps(v).find((r) => r.y === car.carTopAt(walk) - 4);
      const withCalls = stage(carAt(between, { calls: called }));
      const quiet = stage(carAt(between), { liftInUse: true });
      walks.forEach((walk, floor) => {
        expect(lampAt(walk, withCalls)?.colour, `floor ${floor}`).toBe(called.has(floor) ? AMBER.glow : CYAN.base);
        expect(lampAt(walk, quiet)?.colour, `floor ${floor}`).toBe(CYAN.base);
      });
    });
  });

  describe('cables', () => {
    const cables = (view: StageView) =>
      paint(view).rects.filter((r) => r.w === 1 && r.x !== shaft.x && r.y === top && r.h > 2);

    it('hang from the top of the shaft down to the car roof, wherever it is', () => {
      for (const walkY of [...walks, between]) {
        const found = cables(stage(carAt(walkY)));
        expect(found).toHaveLength(2);
        for (const cable of found) expect(cable.y + cable.h).toBe(car.carTopAt(walkY));
      }
    });

    it('shimmer only while the car travels', () => {
      const shimmer = (view: StageView) => paint(view).rects.filter((r) => r.w === 1 && r.h === 2);
      expect(shimmer(stage(carAt(between, { moving: true }))).length).toBeGreaterThan(0);
      expect(shimmer(stage(carAt(highest)))).toHaveLength(0);
    });
  });

  it('blinks an indicator on the roof only while moving', () => {
    const roof = (view: StageView) => paint(view).rects.filter((r) => r.w === 2 && r.h === 2);
    expect(roof(stage(carAt(between, { moving: true }))).length).toBeGreaterThan(0);
    expect(roof(stage(carAt(between)))).toHaveLength(0);
  });

  it('is a pure function of the stage', () => {
    const view = stage(carAt(between, { moving: true, calls: new Set([0]) }), { liftInUse: true });
    expect(paint(view).calls).toEqual(paint(view).calls);
  });
});
