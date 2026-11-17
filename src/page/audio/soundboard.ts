import type { Findings } from '../../contract/snapshot.ts';
import type { Theme } from '../../contract/theme.ts';
import type { EventBus } from '../../engine/event-bus.ts';
import type { SoundOutput } from './sound-output.ts';

/** The part of the Engine the Soundboard listens to. The real `Engine` satisfies it. */
export interface SoundSource {
  readonly bus: EventBus;
  readonly theme: Theme;
  readonly findings: Findings;
}

/**
 * Turns what the lab does into sound (ADR 0004). It listens to the Engine's bus and reads the Theme's
 * Soundscape; the Engine stays silent. For now it sounds one thing: the Alarm, once on the edge.
 */
export class Soundboard {
  private readonly unsubscribe: readonly (() => void)[];
  private alarmPending = false;
  /** `null` until the first Snapshot, so an already open finding on page load is not an edge. */
  private lastCrit: number | null = null;

  constructor(
    private readonly source: SoundSource,
    private readonly output: SoundOutput,
  ) {
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
    ];
  }

  /** Call right after `engine.accept(snapshot)`. Triggers in one Snapshot sound a single Alarm. */
  endSnapshot(): void {
    const { crit } = this.source.findings;
    const critRose = this.lastCrit === 0 && crit > 0;
    this.lastCrit = crit;
    const due = this.alarmPending || critRose;
    this.alarmPending = false;
    if (!due) return;
    const alarm = this.source.theme.soundscape?.alarm;
    if (alarm !== undefined) this.output.play(alarm, { volume: 1, pan: 0 });
  }

  dispose(): void {
    for (const stop of this.unsubscribe) stop();
  }
}
