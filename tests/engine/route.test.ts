import { describe, expect, it } from 'vitest';
import { LIFT_SECONDS, planRoute, Walker } from '../../src/engine/route.ts';

const layout = {
  floors: [
    { walkY: 200, minX: 10, maxX: 300 },
    { walkY: 100, minX: 20, maxX: 250 },
  ],
  liftX: 150,
};

describe('planRoute', () => {
  it('walks straight on the same floor', () => {
    expect(planRoute({ x: 50, floor: 0 }, { x: 120, floor: 0 }, layout)).toEqual([{ kind: 'walk', x: 120 }]);
  });

  it("clamps the target to the floor's span", () => {
    expect(planRoute({ x: 50, floor: 0 }, { x: 999, floor: 0 }, layout)).toEqual([{ kind: 'walk', x: 300 }]);
    expect(planRoute({ x: 50, floor: 1 }, { x: -5, floor: 1 }, layout)).toEqual([{ kind: 'walk', x: 20 }]);
  });

  it('goes via the lift between floors', () => {
    expect(planRoute({ x: 50, floor: 0 }, { x: 200, floor: 1 }, layout)).toEqual([
      { kind: 'walk', x: 150 },
      { kind: 'lift', floor: 1 },
      { kind: 'walk', x: 200 },
    ]);
  });

  it('skips the walk to the lift when already there, and the walk out when the target is the lift', () => {
    expect(planRoute({ x: 150, floor: 0 }, { x: 200, floor: 1 }, layout)).toEqual([
      { kind: 'lift', floor: 1 },
      { kind: 'walk', x: 200 },
    ]);
    expect(planRoute({ x: 50, floor: 0 }, { x: 150, floor: 1 }, layout)).toEqual([
      { kind: 'walk', x: 150 },
      { kind: 'lift', floor: 1 },
    ]);
  });

  it('never plans a walk outside a floor span', () => {
    const steps = planRoute({ x: 50, floor: 0 }, { x: 999, floor: 1 }, layout);
    expect(steps.at(-1)).toEqual({ kind: 'walk', x: 250 });
  });

  it('throws for a floor that does not exist', () => {
    expect(() => planRoute({ x: 0, floor: 0 }, { x: 0, floor: 2 }, layout)).toThrow(RangeError);
    expect(() => planRoute({ x: 0, floor: -1 }, { x: 0, floor: 0 }, layout)).toThrow(RangeError);
  });
});

describe('Walker', () => {
  it('stands on the floor line lifted by its lane', () => {
    const walker = new Walker(layout, { x: 50, floor: 0 }, 6);
    expect(walker).toMatchObject({ x: 50, y: 194, floor: 0, facing: 1, moving: false, inLift: false });
  });

  it('walks at speed and arrives exactly once', () => {
    const walker = new Walker(layout, { x: 50, floor: 0 }, 0);
    walker.goTo({ x: 100, floor: 0 }, 10);
    expect(walker.moving).toBe(true);
    expect(walker.step(2)).toBe(false);
    expect(walker.x).toBe(70);
    expect(walker.step(10)).toBe(true);
    expect(walker.x).toBe(100);
    expect(walker.moving).toBe(false);
    expect(walker.step(1)).toBe(false);
  });

  it('faces the way it last walked', () => {
    const walker = new Walker(layout, { x: 100, floor: 0 }, 0);
    walker.goTo({ x: 50, floor: 0 }, 10);
    walker.step(1);
    expect(walker.facing).toBe(-1);
    walker.goTo({ x: 95, floor: 0 }, 10);
    walker.step(1);
    expect(walker.facing).toBe(1);
  });

  it('arrives on the next step when already at the spot', () => {
    const walker = new Walker(layout, { x: 50, floor: 0 }, 0);
    walker.goTo({ x: 50, floor: 0 }, 10);
    expect(walker.moving).toBe(true);
    expect(walker.step(0.1)).toBe(true);
    expect(walker.step(0.1)).toBe(false);
  });

  it('walks to the lift, then rides it with y moving linearly and the floor changing at the end', () => {
    const walker = new Walker(layout, { x: 140, floor: 0 }, 4);
    walker.goTo({ x: 150, floor: 1 }, 10);
    expect(walker.step(1)).toBe(false);
    expect(walker).toMatchObject({ x: 150, inLift: true, floor: 0, y: 196 });

    expect(walker.step(LIFT_SECONDS / 2)).toBe(false);
    expect(walker.floor).toBe(0);
    expect(walker.y).toBeCloseTo((196 + 96) / 2);

    expect(walker.step(LIFT_SECONDS / 2)).toBe(true);
    expect(walker).toMatchObject({ inLift: false, floor: 1, y: 96 });
  });

  it('carries leftover time from the lift into the walk out', () => {
    const walker = new Walker(layout, { x: 150, floor: 0 }, 0);
    walker.goTo({ x: 160, floor: 1 }, 10);
    expect(walker.step(LIFT_SECONDS + 0.5)).toBe(false);
    expect(walker.x).toBe(155);
    expect(walker.step(1)).toBe(true);
    expect(walker.x).toBe(160);
  });

  it('puts a rider down on the destination floor when stopped mid-lift', () => {
    const walker = new Walker(layout, { x: 150, floor: 0 }, 0);
    walker.goTo({ x: 200, floor: 1 }, 10);
    walker.step(LIFT_SECONDS / 2);
    walker.stop();
    expect(walker).toMatchObject({ inLift: false, moving: false, floor: 1, y: 100, x: 150 });
    expect(walker.step(1)).toBe(false);
  });

  it('stops where it stands on a walk', () => {
    const walker = new Walker(layout, { x: 50, floor: 0 }, 0);
    walker.goTo({ x: 100, floor: 0 }, 10);
    walker.step(1);
    walker.stop();
    expect(walker).toMatchObject({ x: 60, moving: false });
  });

  it('teleports, dropping the route', () => {
    const walker = new Walker(layout, { x: 50, floor: 0 }, 2);
    walker.goTo({ x: 100, floor: 1 }, 10);
    walker.teleport({ x: 220, floor: 1 });
    expect(walker).toMatchObject({ x: 220, y: 98, floor: 1, moving: false });
  });
});
