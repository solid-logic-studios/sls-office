import { describe, expect, it } from 'vitest';
import type { StageView } from '../../src/contract/theme.ts';
import { BANDS, DECK, GROUND_Y, SHAFT } from '../../src/themes/hq/geometry.ts';
import { LIFT_BACK, carTopAt } from '../../src/themes/hq/lift.ts';
import { AMBER, CYAN, HULL } from '../../src/themes/hq/palette.ts';
import { RecordingPainter } from '../support/recording-painter.ts';
import { stage as baseStage } from '../support/stage.ts';

const SHAFT_TOP = BANDS[DECK.upper].ceil;
const CAR_H = 32;

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

function paint(view: StageView): RecordingPainter {
  const painter = new RecordingPainter();
  for (const decor of LIFT_BACK) decor(painter, view);
  return painter;
}

const GROUND_WALK = BANDS[DECK.ground].walk;
const UPPER_WALK = BANDS[DECK.upper].walk;
const walks = [GROUND_WALK, UPPER_WALK];
const between = (GROUND_WALK + UPPER_WALK) / 2;
const LIT_FRAME = CYAN.bright;
const frameOf = (view: StageView) => paint(view).rects.find((r) => r.colour === LIT_FRAME && r.w === 18);
const gaps = (view: StageView) => paint(view).rects.filter((r) => r.colour === HULL.dark && r.w === 6 && r.h === CAR_H);
const lamps = (view: StageView) => paint(view).rects.filter((r) => r.w === 4 && r.h === 1);

describe('the HQ lift car', () => {
  it('stands on the front edge of the floor it is level with, inside the shaft', () => {
    for (const walkY of [...walks, between]) {
      const frame = frameOf(stage(carAt(walkY), { liftInUse: true }));
      expect(frame?.y).toBe(carTopAt(walkY) - 1);
      expect(frame!.x).toBeGreaterThanOrEqual(SHAFT.x);
      expect(frame!.x + frame!.w).toBeLessThanOrEqual(SHAFT.x + SHAFT.w);
      expect(frame!.y + frame!.h).toBeLessThanOrEqual(GROUND_Y);
    }
    expect(carTopAt(BANDS[DECK.ground].walk) + CAR_H).toBe(BANDS[DECK.ground].front);
  });

  it('keeps every mark inside the shaft', () => {
    for (const walkY of [...walks, between]) {
      for (const lift of [carAt(walkY), carAt(walkY, { moving: true, doorsOpen: true, calls: new Set([0, 1]) })]) {
        for (const r of paint(stage(lift, { liftInUse: true })).rects) {
          expect(r.x).toBeGreaterThanOrEqual(SHAFT.x);
          expect(r.x + r.w).toBeLessThanOrEqual(SHAFT.x + SHAFT.w);
          expect(r.y).toBeGreaterThanOrEqual(SHAFT_TOP);
          expect(r.y + r.h).toBeLessThanOrEqual(GROUND_Y);
        }
      }
    }
  });

  it('lights while in use, travelling or open, and sits dark when idle', () => {
    expect(frameOf(stage(carAt(UPPER_WALK), { liftInUse: true }))).toBeDefined();
    expect(frameOf(stage(carAt(UPPER_WALK, { moving: true })))).toBeDefined();
    expect(frameOf(stage(carAt(UPPER_WALK, { doorsOpen: true })))).toBeDefined();
    expect(frameOf(stage(carAt(UPPER_WALK)))).toBeUndefined();
  });

  describe('doors and lamps', () => {
    it('shows the car door gap only while the doors are open', () => {
      const open = gaps(stage(carAt(between, { doorsOpen: true })));
      expect(open.some((r) => r.y === carTopAt(between))).toBe(true);
      expect(gaps(stage(carAt(between)))).toHaveLength(0);
    });

    it('opens the landing doors only on the car floor', () => {
      const tops = gaps(stage(carAt(UPPER_WALK, { doorsOpen: true }))).map((r) => r.y);
      expect(tops).toContain(carTopAt(UPPER_WALK));
      expect(tops).not.toContain(carTopAt(GROUND_WALK));
    });

    it('lights a landing lamp amber only for floors with a call', () => {
      const view = stage(carAt(between), { liftInUse: true });
      const lampAt = (floor: 0 | 1, v: StageView) => lamps(v).find((r) => r.y === carTopAt(BANDS[floor].walk) - 4);
      const called = stage(carAt(between, { calls: new Set([DECK.upper]) }));
      expect(lampAt(DECK.upper, called)?.colour).toBe(AMBER.glow);
      expect(lampAt(DECK.ground, called)?.colour).toBe(CYAN.base);
      expect(lampAt(DECK.upper, view)?.colour).toBe(CYAN.base);
    });
  });

  describe('cables', () => {
    const cables = (view: StageView) =>
      paint(view).rects.filter((r) => r.w === 1 && r.x !== SHAFT.x && r.y === SHAFT_TOP && r.h > 2);

    it('hang from the top of the shaft down to the car roof, wherever it is', () => {
      for (const walkY of [...walks, between]) {
        const found = cables(stage(carAt(walkY)));
        expect(found).toHaveLength(2);
        for (const cable of found) expect(cable.y + cable.h).toBe(carTopAt(walkY));
      }
    });

    it('shimmer only while the car travels', () => {
      const shimmer = (view: StageView) => paint(view).rects.filter((r) => r.w === 1 && r.h === 2);
      expect(shimmer(stage(carAt(between, { moving: true }))).length).toBeGreaterThan(0);
      expect(shimmer(stage(carAt(UPPER_WALK)))).toHaveLength(0);
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
