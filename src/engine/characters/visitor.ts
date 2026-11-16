import type { World } from '../world.ts';
import { Character, type CharacterInit } from './character.ts';
import type { DeskWorker } from './desk-worker.ts';

const PAUSE_SECONDS = 0.5;
const VISIT_SECONDS = 1.1;
/** Pauses this far right of the host it stops by, and stands this far left of the worker's seat. */
const BESIDE_HOST = 6;
const STAND_OFF = 7;

type Trip =
  | { kind: 'arriving' }
  | { kind: 'pausing'; until: number }
  | { kind: 'to-worker' }
  | { kind: 'visiting'; until: number };

/**
 * A passing request: in from the entrance, a pause by the greeter or guards, a visit to one worker,
 * and out again. It tells the worker it has arrived through the bus.
 */
export class Visitor extends Character {
  protected readonly speed = 46;
  private trip: Trip;

  constructor(
    world: World,
    init: CharacterInit,
    private readonly target: DeskWorker,
    private readonly hosts: readonly Character[],
  ) {
    super(world, init);
    this.sceneStatus = 'visiting';
    const host = hosts[0];
    if (host === undefined) {
      this.trip = { kind: 'to-worker' };
      this.goTo(this.beside());
    } else {
      this.trip = { kind: 'arriving' };
      this.goTo({ x: host.x + BESIDE_HOST, floor: host.floor });
    }
  }

  /** Visitors are not part of the chatter. */
  override chatter(): string | undefined {
    return undefined;
  }

  protected behave(): void {
    if (!this.target.present) {
      this.vanish();
      return;
    }
    if (this.moving) return;
    const { now, random } = this.world;
    const trip = this.trip;
    switch (trip.kind) {
      case 'arriving':
        this.greet();
        this.trip = { kind: 'pausing', until: now + PAUSE_SECONDS };
        return;
      case 'pausing':
        if (now < trip.until) return;
        this.goTo(this.beside());
        this.trip = { kind: 'to-worker' };
        return;
      case 'to-worker':
        this.face(1);
        if (random.chance(0.25)) this.sayCue('visitor');
        this.world.bus.publish({ kind: 'visitor', targetId: this.target.id });
        this.trip = { kind: 'visiting', until: now + VISIT_SECONDS };
        return;
      case 'visiting':
        if (now >= trip.until) this.walkOut();
        return;
      default: {
        const unreachable: never = trip;
        throw new Error(`Unknown trip ${String(unreachable)}`);
      }
    }
  }

  private greet(): void {
    const { random } = this.world;
    for (const host of this.hosts) {
      if (host.part === 'greeter' && random.chance(0.3)) host.sayCue('greet');
      else if (host.part === 'guard' && random.chance(0.2)) host.say(host.chatter());
    }
  }

  private beside(): { x: number; floor: number } {
    const seat = this.target.homeSpot ?? { x: this.target.x, floor: this.target.floor };
    return { x: seat.x - STAND_OFF, floor: seat.floor };
  }
}
