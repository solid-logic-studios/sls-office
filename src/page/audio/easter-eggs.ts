import type { EffectName, SynthSound } from '../../contract/theme.ts';
import type { CharacterView } from '../../engine/engine.ts';
import type { MuteStorage } from './mute-preference.ts';
import {
  CENTRE,
  EffectThrottle,
  findCharacter,
  placement,
  type EffectSink,
  type EffectSource,
} from './stage-effects.ts';

/** While a character is fainted, it snores this often. */
export const SNORE_EVERY_MS = 3000;

/** Days with no Alarm that earn the streak jingle, once each, lowest first. */
export const UPTIME_MILESTONES_DAYS: readonly number[] = [7, 30, 100, 365];

/** Morning tea: the local hour, as a fraction, at which the kettle goes on (10:30). */
export const SMOKO_HOUR = 10.5;

/** Healthy deploys in a row that make a hat-trick. */
export const HAT_TRICK_DEPLOYS = 3;

/** When the lab was last seen to Alarm, or when the page first ran: epoch milliseconds. */
export const CALM_SINCE_KEY = 'sls-office.calmSince';

/** The highest streak milestone, in days, already celebrated in this streak. */
export const STREAK_CELEBRATED_KEY = 'sls-office.streakCelebrated';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EasterEggOptions {
  /** Milliseconds on a monotonic clock, for the effect throttle. */
  now: () => number;
  /** Runs `callback` after `ms`. */
  later: (callback: () => void, ms: number) => void;
  /** The local time of day as a fractional hour, 0 to 24. */
  hour: () => number;
  /** Epoch milliseconds, for the uptime streak. */
  wallNow: () => number;
  /** Where the streak is remembered; `null` keeps it in memory for the page load. */
  storage: MuteStorage | null;
}

/**
 * Small surprises (ADR 0004), all effects, so each is throttled like one and the sink applies mute and
 * quiet hours. A fainted character snores until it recovers; a streak of days with no Alarm earns a jingle at
 * each milestone; morning tea has a kettle at 10:30; three healthy deploys in a row are a hat-trick.
 * The Soundboard calls `endSnapshot` after each Snapshot and `alarmed` when it sounds an Alarm.
 */
export class EasterEggs {
  private readonly unsubscribe: readonly (() => void)[];
  private readonly throttle: EffectThrottle;
  private snoring = false;
  private disposed = false;
  private previousHour: number | null = null;
  private healthyRun = 0;
  /** The streak's state, read from storage on first use: epoch ms of the last Alarm, and the milestone celebrated. */
  private calmSince: number | null = null;
  private celebrated = 0;
  private loaded = false;

  constructor(
    private readonly source: EffectSource,
    private readonly sink: EffectSink,
    private readonly options: EasterEggOptions,
  ) {
    this.throttle = new EffectThrottle(options.now);
    this.unsubscribe = [
      source.bus.subscribe('deploy', (event) => {
        if (event.phase === 'healthy') this.onHealthyDeploy(event.subject);
        else if (event.phase === 'rolled-back') this.healthyRun = 0;
      }),
    ];
  }

  dispose(): void {
    this.disposed = true;
    for (const stop of this.unsubscribe) stop();
  }

  /** Starts the streak over: the Soundboard sounded a real Alarm. */
  alarmed(): void {
    this.load();
    this.calmSince = this.options.wallNow();
    this.celebrated = 0;
    this.save();
  }

  /** Call after each Snapshot has been taken by the Engine. */
  endSnapshot(): void {
    this.startSnoring();
    this.checkStreak();
    this.checkSmoko();
  }

  private play(name: EffectName, locate?: () => CharacterView | undefined): void {
    const sound: SynthSound | undefined = this.source.theme.soundscape?.effects?.[name];
    if (sound === undefined || !this.throttle.allow(name)) return;
    this.sink(sound, locate === undefined ? CENTRE : placement(locate(), this.source.layout.width));
  }

  /** The first visible fainted character, in cast order. */
  private sleeper(): CharacterView | undefined {
    return this.source.characters().find((character) => character.visible && character.mood === 'fainted');
  }

  /** Begins the snore loop if someone is fainted and it is not already running. */
  private startSnoring(): void {
    if (this.snoring || this.sleeper() === undefined) return;
    this.snoring = true;
    this.snore();
  }

  /** Snores once from the sleeper and comes back, or ends the loop when nobody is fainted any more. */
  private snore(): void {
    const sleeper = this.sleeper();
    if (this.disposed || sleeper === undefined) {
      this.snoring = false;
      return;
    }
    this.play('snore', () => sleeper);
    this.options.later(() => this.snore(), SNORE_EVERY_MS);
  }

  private onHealthyDeploy(subject: string): void {
    this.healthyRun += 1;
    if (this.healthyRun < HAT_TRICK_DEPLOYS) return;
    this.healthyRun = 0;
    this.play('hatTrick', () => findCharacter(this.source.characters(), subject));
  }

  /** Plays the jingle when a new milestone is reached, and counts it celebrated even if it could not sound. */
  private checkStreak(): void {
    this.load();
    const calmSince = this.calmSince ?? this.options.wallNow();
    if (this.calmSince === null) {
      this.calmSince = calmSince;
      this.save();
    }
    const days = Math.floor((this.options.wallNow() - calmSince) / DAY_MS);
    const milestone = UPTIME_MILESTONES_DAYS.findLast((each) => each <= days);
    if (milestone === undefined || milestone <= this.celebrated) return;
    this.celebrated = milestone;
    this.save();
    this.play('streak');
  }

  /** Puts the kettle on as the clock crosses 10:30 between two Snapshots. */
  private checkSmoko(): void {
    const hour = this.options.hour();
    const previous = this.previousHour;
    this.previousHour = hour;
    if (previous !== null && previous < SMOKO_HOUR && SMOKO_HOUR <= hour) this.play('smoko');
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    const since = Number(this.read(CALM_SINCE_KEY));
    this.calmSince = Number.isFinite(since) && since > 0 ? since : null;
    const celebrated = Number(this.read(STREAK_CELEBRATED_KEY));
    this.celebrated = Number.isFinite(celebrated) && celebrated > 0 ? celebrated : 0;
  }

  private read(key: string): string | null {
    try {
      return this.options.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      if (this.calmSince !== null) this.options.storage?.setItem(CALM_SINCE_KEY, String(this.calmSince));
      this.options.storage?.setItem(STREAK_CELEBRATED_KEY, String(this.celebrated));
    } catch {
      // Not saved; the streak still holds for this page load.
    }
  }
}
