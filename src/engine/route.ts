import type { Floor, Layout, Spot } from '../contract/theme.ts';
import type { Lift, LiftTicket } from './lift.ts';

export type RouteStep = { kind: 'walk'; x: number } | { kind: 'lift'; floor: number };

type RouteLayout = Pick<Layout, 'floors' | 'liftX'>;

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

/**
 * Walks a character along its route. A lift step is wait, then ride: at `liftX` the walker calls the
 * shared `Lift` and stands at the landing in its lane until the car boards it; while riding, its y is
 * the car's walk line less its lane; the lift lets it off at its floor, and the route carries on.
 */
export class Walker {
  private posX: number;
  private floorIndex: number;
  private steps: RouteStep[] = [];
  private speed = 0;
  private facingDir: 1 | -1 = 1;
  /** The call for the lift step under way, from the moment the walker reaches the landing until it is let off. */
  private ticket: LiftTicket | null = null;
  /** A route that ended at the lift door ended when the lift let the walker off: the next step reports it. */
  private arrivedByLift = false;

  constructor(
    private readonly layout: RouteLayout,
    start: Spot,
    /** Pixels above the walk line it walks at, so a crowd does not stand on one line. */
    readonly lane: number,
    private readonly lift: Lift,
  ) {
    floorAt(layout, start.floor);
    this.posX = start.x;
    this.floorIndex = start.floor;
  }

  get x(): number {
    return this.posX;
  }

  get y(): number {
    return (this.inLift ? this.lift.y : this.walkY(this.floorIndex)) - this.lane;
  }

  get floor(): number {
    return this.floorIndex;
  }

  /** Last walking direction. */
  get facing(): 1 | -1 {
    return this.facingDir;
  }

  /** On a route, including waiting for and riding the lift. */
  get moving(): boolean {
    return this.steps.length > 0;
  }

  /** In the car. */
  get inLift(): boolean {
    return this.ticket?.state === 'riding';
  }

  /** At the landing, waiting for the car. */
  get waitingForLift(): boolean {
    return this.ticket?.state === 'waiting';
  }

  /**
   * Replaces the current route. `speed` is art pixels per second. A ride already under way is not
   * interrupted: it finishes, and the new route is planned from where it lets the rider off. A call
   * still waiting is cancelled, and the new route is planned from the landing.
   */
  goTo(target: Spot, speed: number): void {
    const ride = this.keepRideOnly();
    const from = ride === null ? { x: this.posX, floor: this.floorIndex } : { x: this.layout.liftX, floor: ride.floor };
    this.steps.push(...planRoute(from, target, this.layout));
    this.speed = speed;
    this.arrivedByLift = false;
  }

  /** Drops the route where it stands: a ride already under way finishes first, a waiting call is cancelled. */
  stop(): void {
    this.keepRideOnly();
    this.arrivedByLift = false;
  }

  /** Drops the route and leaves the lift at once: the call is cancelled, or the rider taken out of the car. */
  halt(): void {
    if (this.ticket !== null) this.lift.leave(this.ticket);
    this.ticket = null;
    this.steps = [];
    this.arrivedByLift = false;
  }

  /** Moves at once to `spot`, dropping the route and leaving the lift. */
  teleport(spot: Spot): void {
    floorAt(this.layout, spot.floor);
    this.halt();
    this.posX = spot.x;
    this.floorIndex = spot.floor;
  }

  /** Advances by `dt` seconds. Returns true only on the step in which the walker arrives. */
  step(dt: number): boolean {
    if (this.arrivedByLift) {
      this.arrivedByLift = false;
      return true;
    }
    if (this.steps.length === 0) return false;
    let left = dt;
    for (let step = this.steps[0]; step; step = this.steps[0]) {
      const remaining = step.kind === 'walk' ? this.walk(step.x, left) : this.callLift(step.floor);
      if (remaining === null) return false;
      left = remaining;
      this.steps.shift();
    }
    return true;
  }

  private walkY(floor: number): number {
    return floorAt(this.layout, floor).walkY;
  }

  /** The lift step the walker is riding, or `null` when not in the car. */
  private currentRide(): Extract<RouteStep, { kind: 'lift' }> | null {
    const step = this.steps[0];
    return this.inLift && step?.kind === 'lift' ? step : null;
  }

  /** Drops every step but a ride under way, which it returns; with none, cancels a call still waiting. */
  private keepRideOnly(): Extract<RouteStep, { kind: 'lift' }> | null {
    const ride = this.currentRide();
    if (ride === null) this.leaveQueue();
    this.steps = ride === null ? [] : [ride];
    return ride;
  }

  /** Cancels a call still waiting at the landing. */
  private leaveQueue(): void {
    if (this.ticket === null || this.ticket.state !== 'waiting') return;
    this.lift.leave(this.ticket);
    this.ticket = null;
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

  /** At the landing: calls the car once, then waits. The lift ends the step itself, through `alight`. */
  private callLift(floor: number): null {
    this.ticket ??= this.lift.call(this.floorIndex, floor, () => this.alight());
    return null;
  }

  /** The car stands at the walker's floor with its doors open: it steps off and carries on. */
  private alight(): void {
    const step = this.steps[0];
    if (this.ticket === null || step?.kind !== 'lift') return;
    this.floorIndex = this.ticket.to;
    this.posX = this.layout.liftX;
    this.ticket = null;
    this.steps.shift();
    if (this.steps.length === 0) this.arrivedByLift = true;
  }
}
