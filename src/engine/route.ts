import type { Floor, Layout, Spot } from '../contract/theme.ts';

export type RouteStep = { kind: 'walk'; x: number } | { kind: 'lift'; floor: number };

type RouteLayout = Pick<Layout, 'floors' | 'liftX'>;

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
    const here = this.lineY(this.floorIndex);
    const step = this.steps[0];
    if (this.ride === null || step?.kind !== 'lift') return here;
    return here + (this.lineY(step.floor) - here) * (this.ride / LIFT_SECONDS);
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

  /** Replaces any current route. `speed` is art pixels per second. */
  goTo(target: Spot, speed: number): void {
    this.settle();
    this.steps = planRoute({ x: this.posX, floor: this.floorIndex }, target, this.layout);
    this.speed = speed;
  }

  /** Drops the route where it stands; a rider is put down on the floor it was heading for. */
  stop(): void {
    this.settle();
    this.steps = [];
  }

  teleport(spot: Spot): void {
    floorAt(this.layout, spot.floor);
    this.stop();
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

  private lineY(floor: number): number {
    return floorAt(this.layout, floor).walkY - this.lane;
  }

  /** Puts a rider down on the floor the lift was heading for. */
  private settle(): void {
    const step = this.steps[0];
    if (this.ride !== null && step?.kind === 'lift') this.floorIndex = step.floor;
    this.ride = null;
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
    if (elapsed < LIFT_SECONDS) {
      this.ride = elapsed;
      return null;
    }
    this.floorIndex = floor;
    this.ride = null;
    return elapsed - LIFT_SECONDS;
  }
}
