import { assertNever } from '../assert-never.ts';
import type { Floor, Layout, LiftView } from '../contract/theme.ts';

/** Seconds the car takes to travel one floor: three floors take three times it. */
export const LIFT_SECONDS = 0.9;
/** Seconds the doors stay open at a stop. */
export const DWELL_SECONDS = 0.6;
/** Riders the car holds at once. */
export const CAPACITY = 3;

export type LiftLayout = Pick<Layout, 'floors' | 'entrance'>;

type Direction = 1 | -1;

/** Where a rider is: queued at its landing, in the car, or done with the lift (let off, or left). */
export type TicketState = 'waiting' | 'riding' | 'done';

/** A rider's call, from `Lift.call`. Its state changes as the lift serves it. */
export interface LiftTicket {
  readonly from: number;
  readonly to: number;
  readonly state: TicketState;
}

class Ticket implements LiftTicket {
  state: TicketState = 'waiting';

  constructor(
    readonly from: number,
    readonly to: number,
    readonly alight: () => void,
  ) {}

  get direction(): Direction {
    return this.to > this.from ? 1 : -1;
  }
}

/** The car: parked with its doors shut, travelling one floor, or stopped with its doors open. */
type Car =
  | { kind: 'idle'; floor: number }
  | { kind: 'moving'; from: number; to: number; elapsed: number }
  | { kind: 'open'; floor: number; left: number };

const reverse = (direction: Direction): Direction => (direction === 1 ? -1 : 1);

/**
 * The one lift car every rider shares, run by collective control: the car keeps its direction while any
 * call or destination lies ahead, then reverses, and idles where it is with nothing to do. It travels
 * at `LIFT_SECONDS` per floor and stops with its doors open for `DWELL_SECONDS` to let riders off and on.
 * At a stop, waiters going the car's way board, up to `CAPACITY`; with the car empty and nothing ahead,
 * the first waiter on the landing sets the way. Everyone else waits for a later sweep. No randomness.
 *
 * A rider calls the car with `call(from, to, alight)` and keeps the ticket. The ticket's state says
 * whether it is still waiting or riding; `alight` runs the moment the car stands at `to` with its doors
 * open (inside `update`), so the rider is on its floor that same frame. `leave` cancels a call, or
 * takes a rider out of the car at once.
 */
export class Lift {
  private car: Car;
  /** The way the car is sweeping; `null` while idle, or open with nobody yet aboard. */
  private direction: Direction | null = null;
  private waiting: Ticket[] = [];
  private riders: Ticket[] = [];

  constructor(private readonly layout: LiftLayout) {
    this.floorAt(layout.entrance.floor);
    this.car = { kind: 'idle', floor: layout.entrance.floor };
  }

  /** The walk line (`Floor.walkY`) the car is at: a floor's while stopped, between two while travelling. */
  get y(): number {
    const car = this.car;
    switch (car.kind) {
      case 'idle':
      case 'open':
        return this.walkY(car.floor);
      case 'moving': {
        const from = this.walkY(car.from);
        return from + (this.walkY(car.to) - from) * (car.elapsed / LIFT_SECONDS);
      }
      default:
        return assertNever(car, 'car');
    }
  }

  get doorsOpen(): boolean {
    return this.car.kind === 'open';
  }

  /** Floors with someone waiting. */
  get calls(): ReadonlySet<number> {
    return new Set(this.waiting.map((ticket) => ticket.from));
  }

  /** Anyone waiting or riding. */
  get inUse(): boolean {
    return this.waiting.length > 0 || this.riders.length > 0;
  }

  /** How many are in the car. */
  get load(): number {
    return this.riders.length;
  }

  view(): LiftView {
    return { y: this.y, doorsOpen: this.doorsOpen, calls: this.calls };
  }

  /** Queues a rider at the `from` landing for `to`. `alight` runs when the car lets it off at `to`. */
  call(from: number, to: number, alight: () => void): LiftTicket {
    this.floorAt(from);
    this.floorAt(to);
    if (from === to) throw new RangeError(`A lift call from floor ${from} to itself`);
    const ticket = new Ticket(from, to, alight);
    this.waiting.push(ticket);
    return ticket;
  }

  /** Cancels a waiting call, or takes a rider out of the car at once. Nothing happens for a finished ticket. */
  leave(ticket: LiftTicket): void {
    const own = this.waiting.find((mine) => mine === ticket) ?? this.riders.find((mine) => mine === ticket);
    if (own === undefined) return;
    own.state = 'done';
    this.waiting = this.waiting.filter((mine) => mine !== own);
    this.riders = this.riders.filter((mine) => mine !== own);
  }

  /** Advances the car by `dt` seconds. Each pass round the loop uses up the time or changes the car's state. */
  update(dt: number): void {
    let left = Math.max(0, dt);
    for (;;) {
      const car = this.car;
      switch (car.kind) {
        case 'idle':
          if (!this.dispatch(car.floor)) return;
          break;
        case 'moving': {
          const elapsed = car.elapsed + left;
          if (elapsed < LIFT_SECONDS) {
            this.car = { ...car, elapsed };
            return;
          }
          left = elapsed - LIFT_SECONDS;
          this.arrive(car.to);
          break;
        }
        case 'open':
          this.board(car.floor);
          if (left < car.left) {
            this.car = { ...car, left: car.left - left };
            return;
          }
          left -= car.left;
          this.depart(car.floor);
          break;
        default:
          return assertNever(car, 'car');
      }
    }
  }

  /* -------------------------------------------------------------- private */

  /** Sets an idle car going: open here for a waiter on this landing, else towards the first call. */
  private dispatch(here: number): boolean {
    if (this.waiting.some((ticket) => ticket.from === here)) {
      this.direction = null;
      this.open(here);
      return true;
    }
    const first = this.waiting[0];
    if (first === undefined) return false;
    this.direction = first.from > here ? 1 : -1;
    this.car = { kind: 'moving', from: here, to: here + this.direction, elapsed: 0 };
    return true;
  }

  /** The car reaches `floor` mid-sweep: it stops there, or carries on, turns round or parks. */
  private arrive(floor: number): void {
    const direction = this.direction;
    if (direction !== null && this.shouldStop(floor, direction)) this.open(floor);
    else this.depart(floor);
  }

  private shouldStop(floor: number, direction: Direction): boolean {
    if (this.riders.some((ticket) => ticket.to === floor)) return true;
    const here = this.waiting.filter((ticket) => ticket.from === floor);
    if (here.length === 0) return false;
    if (this.riders.length < CAPACITY && here.some((ticket) => ticket.direction === direction)) return true;
    return !this.hasWorkAhead(floor, direction);
  }

  /** Opens the doors at `floor` and lets off whoever was going there. */
  private open(floor: number): void {
    this.car = { kind: 'open', floor, left: DWELL_SECONDS };
    const off = this.riders.filter((ticket) => ticket.to === floor);
    this.riders = this.riders.filter((ticket) => ticket.to !== floor);
    for (const ticket of off) {
      ticket.state = 'done';
      ticket.alight();
    }
  }

  /** Boards waiters on this landing going the car's way, up to `CAPACITY`. */
  private board(floor: number): void {
    const here = this.waiting.filter((ticket) => ticket.from === floor);
    const first = here[0];
    if (first === undefined) return;
    if (this.riders.length === 0 && (this.direction === null || !this.hasWorkAhead(floor, this.direction))) {
      this.direction = first.direction;
    }
    for (const ticket of here) {
      if (this.riders.length >= CAPACITY) return;
      if (ticket.direction !== this.direction) continue;
      ticket.state = 'riding';
      this.waiting = this.waiting.filter((mine) => mine !== ticket);
      this.riders.push(ticket);
    }
  }

  /** Doors shut at `floor`: on the way it was going if there is work ahead, else back, else park. */
  private depart(floor: number): void {
    const first = this.waiting[0];
    const preferred: Direction = this.direction ?? (first !== undefined && first.from < floor ? -1 : 1);
    const next = [preferred, reverse(preferred)].find((direction) => this.hasWorkAhead(floor, direction)) ?? null;
    this.direction = next;
    this.car = next === null ? { kind: 'idle', floor } : { kind: 'moving', from: floor, to: floor + next, elapsed: 0 };
  }

  /** A rider's destination or a waiting call lies beyond `floor` in `direction`. */
  private hasWorkAhead(floor: number, direction: Direction): boolean {
    const ahead = (target: number): boolean => (target - floor) * direction > 0;
    return this.riders.some((ticket) => ahead(ticket.to)) || this.waiting.some((ticket) => ahead(ticket.from));
  }

  private walkY(floor: number): number {
    return this.floorAt(floor).walkY;
  }

  private floorAt(index: number): Floor {
    const floor = this.layout.floors[index];
    if (floor === undefined) throw new RangeError(`No floor ${index}`);
    return floor;
  }
}
