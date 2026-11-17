import type { Findings, Snapshot } from '../../contract/snapshot.ts';
import type { AmbientBed, Layout, SynthSound, Theme } from '../../contract/theme.ts';
import type { CharacterView } from '../../engine/engine.ts';
import type { EventBus } from '../../engine/event-bus.ts';
import { ambientMix, busyness, labLoad } from './ambient-mix.ts';
import { soundSeconds, type AmbientMix, type PlayOptions, type SoundOutput } from './sound-output.ts';
import { StageEffects } from './stage-effects.ts';

/** The part of the Engine the Soundboard listens to. The real `Engine` satisfies it. */
export interface SoundSource {
  readonly bus: EventBus;
  readonly theme: Theme;
  readonly findings: Findings;
  readonly layout: Layout;
  characters(): readonly CharacterView[];
}

export interface SoundboardOptions {
  /** Milliseconds on a monotonic clock. Injected so tests can move it; defaults to `performance.now()`. */
  now?: () => number;
  /** Runs `callback` after `ms`. Injected so tests can fire it by hand; defaults to `setTimeout`. */
  later?: (callback: () => void, ms: number) => void;
}

/** The effect and ambient channels' level while an Alarm sounds, so the Alarm cuts through. */
export const ALARM_DUCK = 0.25;

/** The Soundscape's Alarm-channel sounds. */
type AlarmCue = 'alarm' | 'reminder' | 'allClear';
const FULL_LEVEL = 1;
/** Passed with a `null` bed, which has no mix to speak of. */
const SILENT_MIX: AmbientMix = { room: 0, hum: 0, keysPerSecond: 0 };

/** How long a critical finding stays open before the Reminder sounds, and between Reminders. */
export const REMINDER_MS = 10 * 60 * 1000;

/**
 * Turns what the lab does into sound (ADR 0004). It listens to the Engine's bus and reads the Theme's
 * Soundscape; the Engine stays silent. It sounds the Alarm, the Reminder and the All-clear (channel
 * `alarm`), at most one per Snapshot, in that order of priority. Stage effects (channel `effect`) come
 * from `StageEffects`, and the ambient bed (channel `ambient`) follows the lab's load and the workers'
 * moods; both are ducked while an Alarm sounds.
 */
export class Soundboard {
  private readonly unsubscribe: readonly (() => void)[];
  private readonly now: () => number;
  private readonly later: (callback: () => void, ms: number) => void;
  private readonly effects: StageEffects;
  private alarmPending = false;
  private allClearPending = false;
  /** `null` until the first Snapshot, so an already open finding on page load is not an edge. */
  private lastCrit: number | null = null;
  /** When the open critical finding last sounded (Alarm or Reminder), or when it was first seen. */
  private reminderSince = 0;

  private isMuted = false;
  /** True while an Alarm is sounding, so the lower channels are ducked. */
  private alarmSounding = false;
  /** Counts Alarms, so only the latest one's timer restores the levels. */
  private duckGeneration = 0;
  /** The bed and mix last worked out from a Snapshot, so unmuting can bring the bed straight back. */
  private lastAmbient: { bed: AmbientBed; mix: AmbientMix } | null = null;
  /** Whether the output has been told to run a bed, so a Theme without one is only switched off once. */
  private bedOn = false;

  constructor(
    private readonly source: SoundSource,
    private readonly output: SoundOutput,
    options: SoundboardOptions = {},
  ) {
    this.now = options.now ?? (() => performance.now());
    this.later = options.later ?? ((callback, ms) => void setTimeout(callback, ms));
    this.effects = new StageEffects(source, (sound, placement) => this.playEffect(sound, placement), this.now);
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

  /** While muted nothing plays, and a sound that falls due meanwhile is lost, not queued. Muting cuts off what is playing. */
  get muted(): boolean {
    return this.isMuted;
  }

  set muted(value: boolean) {
    this.isMuted = value;
    if (value) {
      this.output.stop('alarm');
      this.output.stop('effect');
      this.switchBed(null);
    } else if (this.lastAmbient !== null) {
      this.switchBed(this.lastAmbient);
    }
  }

  /**
   * Call right after `engine.accept(snapshot)`, with that same Snapshot. Moves the ambient bed to the lab's
   * load, then sounds at most one thing: Alarm, then All-clear, then Reminder.
   */
  endSnapshot(snapshot: Snapshot): void {
    this.followLab(snapshot);
    const { crit } = this.source.findings;
    const previous = this.lastCrit;
    this.lastCrit = crit;
    const critRose = previous === 0 && crit > 0;
    const alarmDue = this.alarmPending || critRose;
    const allClearDue = this.allClearPending || (previous !== null && previous > 0 && crit === 0);
    this.alarmPending = false;
    this.allClearPending = false;
    const reminderDue = this.advanceReminderClock(crit, previous === null || alarmDue);

    if (alarmDue) this.play('alarm');
    else if (allClearDue) this.play('allClear');
    else if (reminderDue) this.play('reminder');
  }

  dispose(): void {
    for (const stop of this.unsubscribe) stop();
    this.effects.dispose();
    this.switchBed(null);
    // A duck restore still pending finds itself stale and does nothing.
    this.duckGeneration += 1;
  }

  /**
   * Advances the Reminder clock and says whether a Reminder falls due now. The clock restarts on the
   * first Snapshot and on every Alarm, so a Reminder never follows hard on an Alarm.
   */
  private advanceReminderClock(crit: number, restart: boolean): boolean {
    if (crit === 0) return false;
    const now = this.now();
    if (restart) {
      this.reminderSince = now;
      return false;
    }
    if (now - this.reminderSince < REMINDER_MS) return false;
    this.reminderSince = now;
    return true;
  }

  /** Works out the bed's mix from the Snapshot and the cast, and sends it unless muted. A Theme without a bed has none. */
  private followLab(snapshot: Snapshot): void {
    const bed = this.source.theme.soundscape?.ambient;
    this.lastAmbient =
      bed === undefined ? null : { bed, mix: ambientMix(bed, labLoad(snapshot), busyness(this.source.characters())) };
    if (!this.isMuted) this.switchBed(this.lastAmbient);
  }

  /** The one place the ambient bed is set. `null` switches it off, and only tells the output if it was on. */
  private switchBed(target: { bed: AmbientBed; mix: AmbientMix } | null): void {
    if (target !== null) {
      this.output.ambient(target.bed, target.mix);
      this.bedOn = true;
    } else if (this.bedOn) {
      this.output.ambient(null, SILENT_MIX);
      this.bedOn = false;
    }
  }

  /** The one place an Alarm-channel sound plays: silent while muted or when the Theme has no Soundscape. */
  private play(name: AlarmCue): void {
    if (this.isMuted) return;
    const sound = this.source.theme.soundscape?.[name];
    if (sound === undefined) return;
    this.output.play(sound, { channel: 'alarm', volume: 1, pan: 0 });
    if (name === 'alarm') this.duckForAlarm(sound);
  }

  private playEffect(sound: SynthSound, placement: Pick<PlayOptions, 'volume' | 'pan'>): void {
    if (this.isMuted) return;
    this.output.play(sound, { channel: 'effect', ...placement });
  }

  /** Lowers the lower channels for the Alarm's length. A later Alarm takes over the restore, so the first never cuts it short. */
  private duckForAlarm(alarm: SynthSound): void {
    this.alarmSounding = true;
    this.applyLevels();
    this.duckGeneration += 1;
    const generation = this.duckGeneration;
    this.later(
      () => {
        if (generation !== this.duckGeneration) return;
        this.alarmSounding = false;
        this.applyLevels();
      },
      soundSeconds(alarm) * 1000,
    );
  }

  /** The one place the ducked channels' levels are worked out from state. Speech joins here in a later phase. */
  private applyLevels(): void {
    const level = this.alarmSounding ? ALARM_DUCK : FULL_LEVEL;
    this.output.setLevel('effect', level);
    this.output.setLevel('ambient', level);
  }
}
