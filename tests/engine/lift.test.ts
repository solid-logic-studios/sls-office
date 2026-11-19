import { describe, expect, it } from 'vitest';
import { CAPACITY, DWELL_SECONDS, LIFT_SECONDS, Lift, type LiftTicket } from '../../src/engine/lift.ts';

/** Five floors 100 px apart, the bottom one (the basement, 0) at y 400; the car starts on the entrance floor. */
const layout = (entrance = 0) => ({
  floors: [0, 1, 2, 3, 4].map((floor) => ({ walkY: 400 - floor * 100, minX: 0, maxX: 300 })),
  entrance: { x: 0, floor: entrance },
});
const walkY = (floor: number): number => 400 - floor * 100;

const DT = 0.01;

/** A lift on a fake clock, with every rider's alighting time recorded. */
function rig(entrance = 0) {
  const lift = new Lift(layout(entrance));
  let now = 0;
  const alighted = new Map<string, number>();
  const tickets = new Map<string, LiftTicket>();
  const call = (name: string, from: number, to: number): LiftTicket => {
    const ticket = lift.call(from, to, () => alighted.set(name, now));
    tickets.set(name, ticket);
    return ticket;
  };
  const tick = (dt = DT): void => {
    now += dt;
    lift.update(dt);
  };
  /** Runs until `done`, up to `limit` seconds. */
  const until = (done: () => boolean, limit = 120): void => {
    const end = now + limit;
    while (!done() && now < end) tick();
  };
  const state = (name: string) => tickets.get(name)?.state;
  return {
    lift,
    call,
    tick,
    until,
    state,
    alighted,
    get now() {
      return now;
    },
  };
}

describe('Lift', () => {
  it('starts parked on the entrance floor with its doors shut and nobody about', () => {
    const { lift } = rig(2);
    expect(lift).toMatchObject({ y: walkY(2), doorsOpen: false, inUse: false, load: 0 });
    expect(lift.view()).toEqual({ y: walkY(2), doorsOpen: false, calls: new Set() });
  });

  it('idles where it is with nothing to do', () => {
    const { lift, tick } = rig(1);
    for (let i = 0; i < 100; i++) tick();
    expect(lift).toMatchObject({ y: walkY(1), doorsOpen: false });
  });

  it('travels empty to a call from another floor at LIFT_SECONDS per floor, opens, boards and delivers', () => {
    const r = rig(0);
    r.call('a', 3, 1);
    expect(r.lift.calls).toEqual(new Set([3]));
    r.tick();
    expect(r.lift.y).toBeLessThan(walkY(0));
    // Halfway through the three floors up.
    r.until(() => r.now >= 1.5 * LIFT_SECONDS - DT / 2);
    expect(r.lift.y).toBeCloseTo(walkY(0) - 150, 0);
    expect(r.state('a')).toBe('waiting');
    r.until(() => r.lift.doorsOpen);
    expect(r.now).toBeCloseTo(3 * LIFT_SECONDS, 1);
    expect(r.lift.y).toBe(walkY(3));
    expect(r.state('a')).toBe('riding');
    expect(r.lift.calls.size).toBe(0);
    // Doors dwell, then two floors down, and the doors open on floor 1.
    r.until(() => r.alighted.has('a'));
    expect(r.alighted.get('a')).toBeCloseTo(3 * LIFT_SECONDS + DWELL_SECONDS + 2 * LIFT_SECONDS, 1);
    expect(r.lift).toMatchObject({ y: walkY(1), doorsOpen: true, load: 0, inUse: false });
    expect(r.state('a')).toBe('done');
  });

  it('opens at once for a call on the floor where it is parked', () => {
    const r = rig(2);
    r.call('a', 2, 4);
    r.tick();
    expect(r.lift.doorsOpen).toBe(true);
    expect(r.state('a')).toBe('riding');
  });

  it('carries two waiters on one floor going the same way together', () => {
    const r = rig(0);
    r.call('a', 2, 4);
    r.call('b', 2, 3);
    r.until(() => r.lift.doorsOpen);
    expect([r.state('a'), r.state('b')]).toEqual(['riding', 'riding']);
    expect(r.lift.load).toBe(2);
    r.until(() => r.alighted.has('a'));
    expect(r.alighted.get('b')).toBeLessThan(r.alighted.get('a') ?? 0);
  });

  it('picks up a waiter further along the sweep on the way', () => {
    const r = rig(0);
    r.call('a', 0, 4);
    r.tick();
    expect(r.state('a')).toBe('riding');
    r.until(() => r.lift.y < walkY(1));
    r.call('b', 2, 3);
    r.until(() => r.state('b') === 'riding');
    expect(r.lift.y).toBe(walkY(2));
    expect(r.state('a')).toBe('riding');
    r.until(() => r.alighted.has('a'));
    expect(r.alighted.get('b')).toBeLessThan(r.alighted.get('a') ?? 0);
  });

  it('passes a waiter going the other way, and serves it after the reversal', () => {
    const r = rig(0);
    r.call('up', 0, 4);
    r.tick();
    r.call('down', 2, 0);
    // The car passes floor 2 without stopping on the way up.
    r.until(() => r.lift.y <= walkY(3));
    expect(r.state('down')).toBe('waiting');
    r.until(() => r.alighted.has('up'));
    expect(r.state('down')).toBe('waiting');
    r.until(() => r.alighted.has('down'));
    expect(r.alighted.get('down')).toBeGreaterThan(r.alighted.get('up') ?? 0);
  });

  it(`leaves a fourth waiter behind at capacity ${CAPACITY} and serves it later`, () => {
    const r = rig(0);
    for (const name of ['a', 'b', 'c', 'd']) r.call(name, 2, 4);
    r.until(() => r.lift.doorsOpen);
    r.tick();
    expect(r.lift.load).toBe(CAPACITY);
    expect([r.state('a'), r.state('b'), r.state('c'), r.state('d')]).toEqual(['riding', 'riding', 'riding', 'waiting']);
    expect(r.lift.calls).toEqual(new Set([2]));
    r.until(() => r.alighted.has('d'));
    expect(r.alighted.get('d')).toBeGreaterThan(r.alighted.get('a') ?? 0);
  });

  it('removes a cancelled call, and stops for nobody', () => {
    const r = rig(0);
    const ticket = r.call('a', 3, 0);
    r.tick();
    r.lift.leave(ticket);
    expect(ticket.state).toBe('done');
    expect(r.lift.calls.size).toBe(0);
    expect(r.lift.inUse).toBe(false);
    // The car parks on the next floor it reaches rather than carrying on to 3.
    r.until(() => false, 5);
    expect(r.lift).toMatchObject({ y: walkY(1), doorsOpen: false });
  });

  it('lets a rider out of the car at once when it leaves mid-ride', () => {
    const r = rig(0);
    const ticket = r.call('a', 0, 4);
    r.until(() => r.lift.y < walkY(1));
    r.lift.leave(ticket);
    expect(r.lift).toMatchObject({ load: 0, inUse: false });
    r.until(() => false, 10);
    expect(r.alighted.has('a')).toBe(false);
  });

  it('refuses a call to the same floor or a floor that does not exist', () => {
    const { lift } = rig();
    expect(() => lift.call(1, 1, () => undefined)).toThrow(RangeError);
    expect(() => lift.call(0, 9, () => undefined)).toThrow(RangeError);
    expect(() => new Lift(layout(7))).toThrow(RangeError);
  });

  it('delivers a ten-rider burst to the basement within 30 s, never moving faster than a floor per LIFT_SECONDS', () => {
    const r = rig(0);
    // Two or three from every floor above, as at a standup called in the basement.
    const from = [4, 4, 3, 3, 3, 2, 2, 1, 1, 4];
    from.forEach((floor, i) => r.call(`r${i}`, floor, 0));
    let last = r.lift.y;
    let biggest = 0;
    while (r.alighted.size < from.length && r.now < 120) {
      r.tick();
      biggest = Math.max(biggest, Math.abs(r.lift.y - last));
      last = r.lift.y;
    }
    expect(r.alighted.size).toBe(from.length);
    const worst = Math.max(...r.alighted.values());
    // Measured: 22.8 s (four trips of at most three riders, up to four floors each way, with dwells).
    expect(worst).toBeLessThan(30);
    expect(biggest).toBeLessThanOrEqual((100 / LIFT_SECONDS) * DT + 1e-9);
  });

  it('never jumps, under any frame length, across a busy run', () => {
    for (const dt of [0.016, 0.05, 0.11]) {
      const lift = new Lift(layout(0));
      const calls: [number, number][] = [
        [3, 0],
        [1, 4],
        [4, 2],
        [0, 3],
        [2, 1],
      ];
      for (const [from, to] of calls) lift.call(from, to, () => undefined);
      let last = lift.y;
      for (let t = 0; t < 40; t += dt) {
        lift.update(dt);
        expect(Math.abs(lift.y - last)).toBeLessThanOrEqual((100 / LIFT_SECONDS) * dt + 1e-9);
        last = lift.y;
      }
      expect(lift.inUse).toBe(false);
    }
  });
});
