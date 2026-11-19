import type { Floor, Layout, Spot } from '../contract/theme.ts';

export type RouteStep = { kind: 'walk'; x: number } | { kind: 'lift'; floor: number };

type RouteLayout = Pick<Layout, 'floors' | 'liftX'>;

/** Seconds a lift ride takes per floor travelled: one floor takes this long, three take three times it. */
export const LIFT_SECONDS = 0.9;

function floorAt(layout: RouteLayout, index: number): Floor {
  const floor = layout.floors[index];
  if (!floor) throw new RangeError(`No floor ${index}`);
  return floor;
}

function clampToFloor(floor: Floor, x: number): number {
  return Math.min(floor.maxX, Math.max(floor.minX, x));
}

export function planRoute(from: Spot, to: Spot, layout: RouteLayout): RouteStep[] {
  floorAt(layout, from.floor);
  const destination = floorAt(layout, to.floor);
  const x = clampToFloor(destination, to.x);
  if (from.floor === to.floor) return [{ kind: 'walk', x }];

  const steps: RouteStep[] = [];
  if (from.x !== layout.liftX) steps.push({ kind: 'walk', x: layout.liftX });
  steps.push({ kind: 'lift', floor: to.floor });
  if (x !== layout.liftX) steps.push({ kind: 'walk', x });
  return steps;
}

export class Walker {
  private posX: number;
  private floorIndex: number;
  private steps: RouteStep[] = [];
  private speed = 0;
  private facingDir: 1 | -1 = 1;
  /** Seconds into the current lift ride, or `null` when not riding. */
  private ride: number | null = null;

  constructor(
    private readonly layout: RouteLayout,
    start: Spot,
    private readonly lane: number,
  ) {
    floorAt(layout, start.floor);
    this.posX = start.x;
    this.floorIndex = start.floor;
  }

  get x(): number {
    return this.posX;
  }

  get y(): number {
    return (this.liftLineY ?? this.walkY(this.floorIndex)) - this.lane;
  }

  /**
   * The walk line (without the lane offset) the lift is at while this walker rides it, else `null`:
   * interpolated from the ride's start floor to its destination.
   */
  get liftLineY(): number | null {
    const step = this.steps[0];
    if (this.ride === null || step?.kind !== 'lift') return null;
    const from = this.walkY(this.floorIndex);
    return from + (this.walkY(step.floor) - from) * (this.ride / this.rideSeconds(step.floor));
  }

  get floor(): number {
    return this.floorIndex;
  }

  /** Last walking direction. */
  get facing(): 1 | -1 {
    return this.facingDir;
  }

  get moving(): boolean {
    return this.steps.length > 0;
  }

  get inLift(): boolean {
    return this.ride !== null;
  }

  /**
   * Replaces the current route. `speed` is art pixels per second. A ride already under way is not
   * interrupted: it finishes, and the new route is planned from where it lets the rider off.
   */
  goTo(target: Spot, speed: number): void {
    const ride = this.currentRide();
    this.steps = ride === null ? [] : [ride];
    const from = ride === null ? { x: this.posX, floor: this.floorIndex } : { x: this.layout.liftX, floor: ride.floor };
    this.steps.push(...planRoute(from, target, this.layout));
    this.speed = speed;
  }

  /** Drops the route where it stands; a ride already under way finishes first. */
  stop(): void {
    const ride = this.currentRide();
    this.steps = ride === null ? [] : [ride];
  }

  /** Moves at once to `spot`, dropping the route and any ride. */
  teleport(spot: Spot): void {
    floorAt(this.layout, spot.floor);
    this.steps = [];
    this.ride = null;
    this.posX = spot.x;
    this.floorIndex = spot.floor;
  }

  /** Advances by `dt` seconds. Returns true only on the step in which the walker arrives. */
  step(dt: number): boolean {
    if (this.steps.length === 0) return false;
    let left = dt;
    for (let step = this.steps[0]; step; step = this.steps[0]) {
      const remaining = step.kind === 'walk' ? this.walk(step.x, left) : this.rideLift(step.floor, left);
      if (remaining === null) return false;
      left = remaining;
      this.steps.shift();
    }
    return true;
  }

  private walkY(floor: number): number {
    return floorAt(this.layout, floor).walkY;
  }

  /** How long a ride from the floor the walker is on to `floor` takes. */
  private rideSeconds(floor: number): number {
    return LIFT_SECONDS * Math.abs(floor - this.floorIndex);
  }

  /** The lift step the walker is part-way through, or `null` when not riding. */
  private currentRide(): Extract<RouteStep, { kind: 'lift' }> | null {
    const step = this.steps[0];
    return this.ride !== null && step?.kind === 'lift' ? step : null;
  }

  /** Returns the time left over once the step is done, or `null` if it is not done yet. */
  private walk(targetX: number, left: number): number | null {
    const distance = Math.abs(targetX - this.posX);
    const reach = this.speed * left;
    if (distance > 0) this.facingDir = targetX > this.posX ? 1 : -1;
    if (distance > reach) {
      this.posX += this.facingDir * reach;
      return null;
    }
    this.posX = targetX;
    return distance === 0 ? left : left - distance / this.speed;
  }

  private rideLift(floor: number, left: number): number | null {
    const elapsed = (this.ride ?? 0) + left;
    const duration = this.rideSeconds(floor);
    if (elapsed < duration) {
      this.ride = elapsed;
      return null;
    }
    this.floorIndex = floor;
    this.ride = null;
    return elapsed - duration;
  }
}
