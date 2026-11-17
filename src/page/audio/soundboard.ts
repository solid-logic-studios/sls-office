import type { Findings } from '../../contract/snapshot.ts';
import type { Soundscape, Theme } from '../../contract/theme.ts';
import type { EventBus } from '../../engine/event-bus.ts';
import type { SoundOutput } from './sound-output.ts';

/** The part of the Engine the Soundboard listens to. The real `Engine` satisfies it. */
export interface SoundSource {
  readonly bus: EventBus;
  readonly theme: Theme;
  readonly findings: Findings;
}

export interface SoundboardOptions {
  /** Milliseconds on a monotonic clock. Injected so tests can move it; defaults to `performance.now()`. */
  now?: () => number;
}

/** How long a critical finding stays open before the Reminder sounds, and between Reminders. */
export const REMINDER_MS = 10 * 60 * 1000;

/**
 * Turns what the lab does into sound (ADR 0004). It listens to the Engine's bus and reads the Theme's
 * Soundscape; the Engine stays silent. It sounds the Alarm, the Reminder and the All-clear, at most one
 * per Snapshot, in that order of priority.
 */
export class Soundboard {
  private readonly unsubscribe: readonly (() => void)[];
  private readonly now: () => number;
  private alarmPending = false;
  private allClearPending = false;
  /** `null` until the first Snapshot, so an already open finding on page load is not an edge. */
  private lastCrit: number | null = null;
  /** When the open critical finding last sounded (Alarm or Reminder), or when it was first seen. */
  private reminderSince = 0;

  /** While muted nothing plays, and a sound that falls due meanwhile is lost, not queued. */
  muted = false;

  constructor(
    private readonly source: SoundSource,
    private readonly output: SoundOutput,
    options: SoundboardOptions = {},
  ) {
    this.now = options.now ?? (() => performance.now());
    const arm = (): void => {
      this.alarmPending = true;
    };
    const { bus } = source;
    this.unsubscribe = [
      bus.subscribe('oom', arm),
      bus.subscribe('vm-down', arm),
      bus.subscribe('deploy', (event) => {
        if (event.phase === 'rolled-back') arm();
      }),
      bus.subscribe('backup', (event) => {
        if (event.phase === 'failed') arm();
      }),
      bus.subscribe('vm-up', () => {
        this.allClearPending = true;
      }),
    ];
  }

  /** Call right after `engine.accept(snapshot)`. Sounds at most one thing: Alarm, then All-clear, then Reminder. */
  endSnapshot(): void {
    const { crit } = this.source.findings;
    const previous = this.lastCrit;
    this.lastCrit = crit;
    const critRose = previous === 0 && crit > 0;
    const alarmDue = this.alarmPending || critRose;
    const allClearDue = this.allClearPending || (previous !== null && previous > 0 && crit === 0);
    this.alarmPending = false;
    this.allClearPending = false;
    const reminderDue = this.reminderFallsDue(previous === null, critRose, crit);

    if (alarmDue) this.play('alarm');
    else if (allClearDue) this.play('allClear');
    else if (reminderDue) this.play('reminder');
  }

  dispose(): void {
    for (const stop of this.unsubscribe) stop();
  }

  /** Advances the Reminder clock and says whether a Reminder is owed now, whatever else sounds. */
  private reminderFallsDue(first: boolean, critRose: boolean, crit: number): boolean {
    if (crit === 0) return false;
    const now = this.now();
    if (first || critRose) {
      this.reminderSince = now;
      return false;
    }
    if (now - this.reminderSince < REMINDER_MS) return false;
    this.reminderSince = now;
    return true;
  }

  /** The one place a sound plays: silent while muted or when the Theme has no Soundscape. */
  private play(name: keyof Soundscape): void {
    if (this.muted) return;
    const sound = this.source.theme.soundscape?.[name];
    if (sound !== undefined) this.output.play(sound, { volume: 1, pan: 0 });
  }
}
