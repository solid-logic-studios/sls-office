import { describe, expect, it } from 'vitest';
import { LiftCar, type LiftRider } from '../../src/engine/lift-car.ts';

const floors = [
  { walkY: 300, minX: 0, maxX: 100 },
  { walkY: 200, minX: 0, maxX: 100 },
  { walkY: 100, minX: 0, maxX: 100 },
];
const rider = (liftLineY: number): LiftRider => ({ inLift: true, liftLineY });
const walker: LiftRider = { inLift: false, liftLineY: null };

describe('LiftCar', () => {
  it('is null before any ride', () => {
    const car = new LiftCar(floors);
    car.update([walker]);
    expect(car.y).toBeNull();
    expect(car.inUse).toBe(false);
  });

  it('tracks a multi-floor ride then parks on the destination', () => {
    const car = new LiftCar(floors);
    car.update([rider(300)]);
    expect(car.y).toBe(300);
    car.update([rider(250)]);
    expect(car.y).toBe(250);
    car.update([rider(120)]);
    expect(car.y).toBe(120);
    car.update([walker]);
    expect(car.y).toBe(100);
    car.update([]);
    expect(car.y).toBe(100);
  });

  it('parks at the nearest floor when the rider vanishes mid-ride', () => {
    const car = new LiftCar(floors);
    car.update([rider(240)]);
    car.update([]);
    expect(car.y).toBe(200);
  });

  it('is in use only while someone rides', () => {
    const car = new LiftCar(floors);
    car.update([rider(300)]);
    expect(car.inUse).toBe(true);
    car.update([walker]);
    expect(car.inUse).toBe(false);
  });
});
