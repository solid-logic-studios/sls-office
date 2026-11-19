import type { Findings, Vm } from '../contract/snapshot.ts';
import type { Theme } from '../contract/theme.ts';
import type { BreakSpots } from './break-spots.ts';
import type { Bubbles } from './bubbles.ts';
import type { Cast } from './cast.ts';
import type { Effects } from './effects.ts';
import type { EventBus } from './event-bus.ts';
import type { Lift } from './lift.ts';
import type { Random } from './random.ts';
import type { SetPieces } from './set-pieces.ts';

/** Animation time in seconds, shared by the Engine and every Stage it builds. */
export interface Clock {
  readonly now: number;
}

/**
 * The shared systems of one Stage: what characters and scenes may reach. It is passed in, never
 * global, so a test can build the Engine twice in one process.
 */
export interface World extends Clock {
  readonly bus: EventBus;
  readonly random: Random;
  readonly theme: Theme;
  readonly findings: Findings;
  readonly vms: readonly Vm[];
  readonly cast: Cast;
  readonly effects: Effects;
  readonly bubbles: Bubbles;
  readonly breakSpots: BreakSpots;
  readonly setPieces: SetPieces;
  /** The one lift car every rider shares. */
  readonly lift: Lift;
}
