import { describe, expect, it } from 'vitest';
import { DWELL_SECONDS, LIFT_SECONDS, Lift } from '../../src/engine/lift.ts';
import { planRoute, Walker } from '../../src/engine/route.ts';

const layout = {
  floors: [
    { walkY: 200, minX: 10, maxX: 300 },
    { walkY: 100, minX: 20, maxX: 250 },
  ],
  liftX: 150,
  entrance: { x: 0, floor: 0 },
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

const tall = {
  floors: [
    { walkY: 300, minX: 10, maxX: 300 },
    { walkY: 200, minX: 10, maxX: 300 },
    { walkY: 100, minX: 10, maxX: 300 },
    { walkY: 0, minX: 10, maxX: 300 },
  ],
  liftX: 150,
  entrance: { x: 0, floor: 0 },
};

type TestLayout = typeof layout | typeof tall;

/** A walker and the lift it shares, stepped the way the Stage steps them: the lift first. */
function world(on: TestLayout, start: { x: number; floor: number }, lane = 0) {
  const lift = new Lift(on);
  const walker = new Walker(on, start, lane, lift);
  const frame = (dt: number): boolean => {
    lift.update(dt);
    return walker.step(dt);
  };
  /** Runs frames of `dt` until `done`, up to `limit` seconds; returns the seconds taken. */
  const until = (done: () => boolean, limit = 30, dt = 0.05): number => {
    let t = 0;
    while (!done() && t < limit) {
      frame(dt);
      t += dt;
    }
    return t;
  };
  return { lift, walker, frame, until };
}

describe('Walker', () => {
  it('stands on the floor line lifted by its lane', () => {
    const { walker } = world(layout, { x: 50, floor: 0 }, 6);
    expect(walker).toMatchObject({ x: 50, y: 194, floor: 0, facing: 1, moving: false, inLift: false });
    expect(walker.waitingForLift).toBe(false);
  });

  it('walks at speed and arrives exactly once', () => {
    const { walker } = world(layout, { x: 50, floor: 0 });
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
    const { walker } = world(layout, { x: 100, floor: 0 });
    walker.goTo({ x: 50, floor: 0 }, 10);
    walker.step(1);
    expect(walker.facing).toBe(-1);
    walker.goTo({ x: 95, floor: 0 }, 10);
    walker.step(1);
    expect(walker.facing).toBe(1);
  });

  it('arrives on the next step when already at the spot', () => {
    const { walker } = world(layout, { x: 50, floor: 0 });
    walker.goTo({ x: 50, floor: 0 }, 10);
    expect(walker.moving).toBe(true);
    expect(walker.step(0.1)).toBe(true);
    expect(walker.step(0.1)).toBe(false);
  });

  it('waits at liftX in its lane until the car boards it, then its y tracks the car', () => {
    // The car starts at the entrance floor (0); the walker calls it from floor 1.
    const { lift, walker, frame, until } = world(tall, { x: 140, floor: 1 }, 4);
    walker.goTo({ x: 150, floor: 3 }, 10);
    frame(1);
    expect(walker).toMatchObject({ x: 150, floor: 1, y: 196, moving: true, inLift: false, waitingForLift: true });
    expect(lift.calls).toEqual(new Set([1]));

    // The empty car comes up one floor; the walker stands still at the landing meanwhile.
    until(() => walker.inLift);
    expect(walker).toMatchObject({ x: 150, floor: 1, y: 196, waitingForLift: false });
    expect(lift.calls.size).toBe(0);

    // Riding, its y is the car's walk line less its lane, every frame.
    let frames = 0;
    while (walker.inLift && frames < 200) {
      frame(0.05);
      frames += 1;
      if (walker.inLift) expect(walker.y).toBeCloseTo(lift.y - 4);
    }
    expect(walker).toMatchObject({ inLift: false, moving: false, floor: 3, y: -4, x: 150 });
  });

  it('reports arrival once when the route ends at the lift door', () => {
    const { lift, walker, until } = world(layout, { x: 150, floor: 0 });
    walker.goTo({ x: 150, floor: 1 }, 10);
    let arrivals = 0;
    for (let t = 0; t < 10; t += 0.05) {
      lift.update(0.05);
      if (walker.step(0.05)) arrivals += 1;
    }
    expect(arrivals).toBe(1);
    expect(until(() => !walker.moving)).toBe(0);
  });

  it('carries on with its route once let off', () => {
    const { walker, until } = world(layout, { x: 150, floor: 0 });
    walker.goTo({ x: 160, floor: 1 }, 10);
    until(() => walker.floor === 1);
    // Let off at liftX, it walks on in the same frame.
    expect(walker).toMatchObject({ moving: true, inLift: false });
    expect(walker.x).toBeGreaterThanOrEqual(150);
    expect(walker.x).toBeLessThan(151);
    until(() => !walker.moving);
    expect(walker).toMatchObject({ x: 160, floor: 1, y: 100 });
  });

  it('cancels its call when sent elsewhere while waiting, and re-plans from the landing', () => {
    const { lift, walker, frame } = world(tall, { x: 150, floor: 2 });
    walker.goTo({ x: 150, floor: 0 }, 10);
    frame(0.05);
    expect(walker.waitingForLift).toBe(true);
    walker.goTo({ x: 100, floor: 2 }, 10);
    expect(walker).toMatchObject({ waitingForLift: false, moving: true });
    expect(lift.calls.size).toBe(0);
    expect(lift.inUse).toBe(false);
    frame(10);
    expect(walker).toMatchObject({ x: 100, floor: 2, moving: false });
  });

  it('re-calls the lift for the new floor when redirected while waiting', () => {
    const { lift, walker, frame } = world(tall, { x: 150, floor: 2 });
    walker.goTo({ x: 150, floor: 0 }, 10);
    frame(0.05);
    walker.goTo({ x: 150, floor: 3 }, 10);
    frame(0.05);
    expect(walker.waitingForLift).toBe(true);
    expect(lift.calls).toEqual(new Set([2]));
  });

  it('cancels its call and stays at the landing when stopped while waiting', () => {
    const { lift, walker, frame } = world(tall, { x: 140, floor: 2 });
    walker.goTo({ x: 150, floor: 0 }, 10);
    frame(1);
    expect(walker.waitingForLift).toBe(true);
    walker.stop();
    expect(walker).toMatchObject({ x: 150, floor: 2, moving: false, waitingForLift: false });
    expect(lift.inUse).toBe(false);
  });

  it('finishes the ride, then stops, when stopped mid-ride', () => {
    const { lift, walker, until } = world(tall, { x: 150, floor: 0 });
    walker.goTo({ x: 200, floor: 2 }, 10);
    until(() => walker.inLift);
    until(() => lift.y < 250);
    const y = walker.y;
    walker.stop();
    expect(walker).toMatchObject({ inLift: true, moving: true, y });
    until(() => !walker.moving);
    expect(walker).toMatchObject({ inLift: false, moving: false, floor: 2, y: 100, x: 150 });
  });

  it('redirects mid-ride without a jump, finishing the ride then walking to the new target', () => {
    const { lift, walker, until } = world(tall, { x: 150, floor: 0 });
    walker.goTo({ x: 200, floor: 2 }, 10);
    until(() => walker.inLift);
    until(() => lift.y < 250);
    const y = walker.y;
    walker.goTo({ x: 170, floor: 0 }, 10);
    expect(walker).toMatchObject({ inLift: true, floor: 0, y });
    until(() => walker.floor === 2);
    expect(walker).toMatchObject({ inLift: false, x: 150 });
    // It then takes the lift back down and walks to the new target.
    until(() => !walker.moving);
    expect(walker).toMatchObject({ x: 170, floor: 0, moving: false });
  });

  it('stops where it stands on a walk', () => {
    const { walker } = world(layout, { x: 50, floor: 0 });
    walker.goTo({ x: 100, floor: 0 }, 10);
    walker.step(1);
    walker.stop();
    expect(walker).toMatchObject({ x: 60, moving: false });
  });

  it('teleports, dropping the route', () => {
    const { walker } = world(layout, { x: 50, floor: 0 }, 2);
    walker.goTo({ x: 100, floor: 1 }, 10);
    walker.teleport({ x: 220, floor: 1 });
    expect(walker).toMatchObject({ x: 220, y: 98, floor: 1, moving: false });
  });

  it('leaves the queue when teleported while waiting', () => {
    const { lift, walker, frame } = world(tall, { x: 150, floor: 2 });
    walker.goTo({ x: 150, floor: 0 }, 10);
    frame(0.05);
    expect(lift.calls).toEqual(new Set([2]));
    walker.teleport({ x: 40, floor: 0 });
    expect(lift.inUse).toBe(false);
    expect(walker).toMatchObject({ x: 40, y: 300, floor: 0, moving: false, waitingForLift: false });
  });

  it('teleports at once out of the car, which no longer carries it', () => {
    const { lift, walker, until } = world(tall, { x: 150, floor: 0 });
    walker.goTo({ x: 200, floor: 3 }, 10);
    until(() => walker.inLift);
    until(() => lift.y < 250);
    expect(lift.load).toBe(1);
    walker.teleport({ x: 40, floor: 0 });
    expect(walker).toMatchObject({ x: 40, y: 300, floor: 0, moving: false, inLift: false });
    expect(lift.load).toBe(0);
    expect(lift.inUse).toBe(false);
  });

  it('halts out of the queue or the car at once (as when hidden)', () => {
    const waiting = world(tall, { x: 150, floor: 2 });
    waiting.walker.goTo({ x: 150, floor: 0 }, 10);
    waiting.frame(0.05);
    waiting.walker.halt();
    expect(waiting.lift.inUse).toBe(false);
    expect(waiting.walker).toMatchObject({ moving: false, waitingForLift: false, floor: 2 });

    const riding = world(tall, { x: 150, floor: 0 });
    riding.walker.goTo({ x: 150, floor: 3 }, 10);
    riding.until(() => riding.walker.inLift);
    riding.walker.halt();
    expect(riding.lift.inUse).toBe(false);
    expect(riding.walker).toMatchObject({ moving: false, inLift: false });
  });

  it('takes a dwell plus LIFT_SECONDS per floor for a ride from the floor the car waits at', () => {
    const { walker, until } = world(tall, { x: 150, floor: 0 });
    walker.goTo({ x: 150, floor: 3 }, 10);
    const taken = until(() => !walker.moving, 30, 0.01);
    // Doors open, then three floors.
    expect(taken).toBeGreaterThanOrEqual(DWELL_SECONDS + 3 * LIFT_SECONDS - 0.02);
    expect(taken).toBeLessThanOrEqual(DWELL_SECONDS + 3 * LIFT_SECONDS + 0.05);
    expect(walker).toMatchObject({ floor: 3, y: 0 });
  });
});
