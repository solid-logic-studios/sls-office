import type { Founder as FounderData } from '../../contract/theme.ts';
import type { World } from '../world.ts';
import { Character, type CharacterInit } from './character.ts';
import type { DeskWorker } from './desk-worker.ts';

/** How long a worker takes to answer a check-in, and how long the founder lingers. */
const REPLY_SECONDS = 1.3;
const CHECK_IN_SECONDS = 3.5;
/** Stands this far left of the worker's seat. */
const STAND_OFF = 11;

type Errand =
  | { kind: 'desk'; until: number }
  | { kind: 'to-break'; spot: number }
  | { kind: 'break'; until: number }
  | { kind: 'to-worker'; worker: DeskWorker }
  | { kind: 'check-in'; worker: DeskWorker; replyAt: number | null; until: number }
  | { kind: 'to-desk' };

/** Types at the desk; now and then checks in on a seated worker or takes a break. Never in the Snapshot. */
export class Founder extends Character {
  protected readonly speed = 30;
  private errand: Errand;

  constructor(
    world: World,
    init: CharacterInit,
    private readonly founder: FounderData,
  ) {
    super(world, init);
    this.errand = { kind: 'desk', until: world.now + world.random.range(4, 15) };
  }

  override chatter(): string | undefined {
    const { lines } = this.founder;
    return this.line(this.world.findings.crit > 0 ? lines.alarm : lines.idle);
  }

  protected behave(): void {
    if (this.moving) return;
    const { now, random } = this.world;
    const errand = this.errand;
    switch (errand.kind) {
      case 'desk':
        this.atDesk(errand.until);
        return;
      case 'to-break': {
        const spot = this.world.theme.layout.breakSpots[errand.spot];
        this.world.breakSpots.arrive(errand.spot);
        if (spot?.sitY !== undefined) this.sitAt(spot.sitY);
        this.setActivity(this.seated ? 'idle' : 'stand');
        this.errand = { kind: 'break', until: now + random.range(6, 12) };
        return;
      }
      case 'break':
        if (now >= errand.until) this.headBack();
        return;
      case 'to-worker':
        this.face(1);
        this.setActivity('stand');
        this.say(this.line(this.founder.lines.checkIn), true);
        this.errand = {
          kind: 'check-in',
          worker: errand.worker,
          replyAt: now + REPLY_SECONDS,
          until: now + CHECK_IN_SECONDS,
        };
        return;
      case 'check-in':
        if (errand.replyAt !== null && now >= errand.replyAt) {
          this.world.bus.publish({ kind: 'check-in', fromId: this.id, toId: errand.worker.id });
          errand.replyAt = null;
        }
        if (now >= errand.until) this.headBack();
        return;
      case 'to-desk':
        this.sitAtHome();
        this.errand = { kind: 'desk', until: now + random.range(8, 16) };
        return;
      default: {
        const unreachable: never = errand;
        throw new Error(`Unknown errand ${String(unreachable)}`);
      }
    }
  }

  private atDesk(until: number): void {
    if (!this.atHome) {
      this.headBack();
      return;
    }
    this.sitAtHome();
    this.setActivity('type');
    if (this.world.now < until) return;
    if (this.world.random.chance(0.35) && this.checkIn()) return;
    if (this.takeBreak()) return;
    this.errand = { kind: 'desk', until: this.world.now + 4 };
  }

  private checkIn(): boolean {
    const worker = this.world.random.pick(this.world.cast.availableWorkers());
    const seat = worker?.homeSpot;
    if (worker === undefined || seat === null || seat === undefined) return false;
    this.goTo({ x: seat.x - STAND_OFF, floor: seat.floor });
    this.errand = { kind: 'to-worker', worker };
    return true;
  }

  private takeBreak(): boolean {
    const claim = this.world.breakSpots.claim(this.id);
    if (claim === null) return false;
    this.goTo(claim.spot);
    this.errand = { kind: 'to-break', spot: claim.index };
    return true;
  }

  private headBack(): void {
    this.world.breakSpots.release(this.id);
    this.goHome();
    this.errand = { kind: 'to-desk' };
  }
}
