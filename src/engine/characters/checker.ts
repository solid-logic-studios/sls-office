import { assertNever } from '../../assert-never.ts';
import type { Place } from '../../contract/theme.ts';
import { Character } from './character.ts';

/** Seconds at home between rounds. */
export const ROUND_PAUSE_SECONDS = 4;
const STOP_SECONDS = 0.8;
/** Stands this far left of a worker's seat to look it over. */
const STAND_OFF = 6;
const MARK_LIFT = 26;

type Round = { kind: 'next' } | { kind: 'to-desk'; place: Place } | { kind: 'homeward' };

/** Walks rounds of the occupied worker places in order, marking each worker well or not. */
export class Checker extends Character {
  protected readonly speed = 46;
  private stop = -1;
  private round: Round = { kind: 'next' };
  private waitUntil = 0;

  protected behave(): void {
    if (this.moving || this.world.now < this.waitUntil) return;
    this.setActivity('stand');
    switch (this.round.kind) {
      case 'to-desk':
        this.inspect(this.round.place);
        this.round = { kind: 'next' };
        this.waitUntil = this.world.now + STOP_SECONDS;
        return;
      case 'homeward':
        this.sitAtHome();
        this.round = { kind: 'next' };
        this.waitUntil = this.world.now + ROUND_PAUSE_SECONDS;
        return;
      case 'next':
        this.nextStop();
        return;
      default:
        return assertNever(this.round, 'round');
    }
  }

  /** A scene took it mid-round: go back to the worker it was heading for. */
  protected override onRelease(): void {
    if (this.round.kind === 'to-desk') this.stop -= 1;
    this.round = { kind: 'next' };
  }

  private nextStop(): void {
    this.stop += 1;
    const place = this.world.cast.homes.occupied('worker')[this.stop];
    if (place !== undefined) {
      this.goTo({ x: place.seat.x - STAND_OFF, floor: place.floor });
      this.round = { kind: 'to-desk', place };
      return;
    }
    this.stop = -1;
    this.goHome();
    this.round = { kind: 'homeward' };
  }

  private inspect(place: Place): void {
    this.face(1);
    const worker = this.world.cast.homes.occupantOf(place);
    const well = worker !== null && worker.mood !== 'absent' && worker.mood !== 'fainted';
    this.world.effects.mark(well ? 'tick' : 'cross', place.seat.x - 2, place.baseY - MARK_LIFT);
  }
}
