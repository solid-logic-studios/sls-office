import type { Theme } from '../../contract/theme.ts';
import type { EventBus } from '../../engine/event-bus.ts';
import type { OfficeDiary } from './office-diary.ts';
import { standupAnnouncement } from './standup-announcement.ts';
import { localDayNumber, type StandupSchedule } from './standup-schedule.ts';

/** How long after calling the founder the summary is given anyway, if they have not reached the front. */
export const STANDUP_ARRIVAL_ALLOWANCE_MS = 60_000;

/** The part of the Engine the Standup uses. The real `Engine` satisfies it. */
export interface StandupStage {
  readonly bus: EventBus;
  readonly theme: Theme;
  callStandup(founderId: string): boolean;
}

/** The part of the Soundboard the Standup uses. The real `Soundboard` satisfies it. */
export interface StandupVoice {
  readonly maySpeak: boolean;
  announce(pieces: readonly string[], speakerId?: string): void;
}

/**
 * The morning Standup (ADR 0004). At 09:00 local a founder, a different one each day, walks to the front
 * (the Engine, which stays silent) and, on arriving, gives an Announcement summing up the diary's last 24
 * hours in their own Voice. The summary does not depend on the walk: if the founder has not arrived within
 * `STANDUP_ARRIVAL_ALLOWANCE_MS` (the page is paused, or the Theme was switched mid-walk) it is given then, once,
 * and a later arrival says nothing. The day is marked done as soon as it falls due, so a Standup that cannot be
 * spoken (muted, quiet hours, no founders or vocabulary) is skipped for the day and not retried.
 */
export class Standup {
  private readonly unsubscribe: () => void;
  /** The founder called and not yet summed up for, if any. */
  private pending: string | null = null;
  /** Counts the calls, so an earlier call's allowance running out is not taken for the latest one's. */
  private calls = 0;

  constructor(
    private readonly stage: StandupStage,
    private readonly voice: StandupVoice,
    private readonly diary: OfficeDiary,
    private readonly schedule: StandupSchedule,
    /** Runs `callback` after `ms`. It cannot be cancelled, so a stale wake-up must be harmless. */
    private readonly later: (callback: () => void, ms: number) => void = (callback, ms) => {
      setTimeout(callback, ms);
    },
  ) {
    this.unsubscribe = stage.bus.subscribe('standup', (event) => this.give(event.founderId));
  }

  /** Call on each Snapshot with the wall-clock time: runs the Standup if it falls due. */
  check(now: Date): void {
    if (!this.schedule.due(now)) return;
    this.schedule.markDone(now);
    this.run(now);
  }

  /** Calls today's founder to the front, without the schedule. `false` if it cannot be spoken or nobody came. */
  run(now: Date): boolean {
    const { founders, soundscape } = this.stage.theme;
    const founder = founders[localDayNumber(now) % founders.length];
    if (founder === undefined || soundscape?.vocabulary === undefined || !this.voice.maySpeak) return false;
    if (!this.stage.callStandup(founder.id)) return false;
    this.pending = founder.id;
    const call = (this.calls += 1);
    this.later(() => {
      if (this.calls === call) this.give(founder.id);
    }, STANDUP_ARRIVAL_ALLOWANCE_MS);
    return true;
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** Says the day's summary in the founder's Voice, once: on arrival or when the allowance runs out. */
  private give(founderId: string): void {
    if (this.pending !== founderId) return;
    this.pending = null;
    const vocabulary = this.stage.theme.soundscape?.vocabulary;
    if (vocabulary === undefined) return;
    this.voice.announce(standupAnnouncement(vocabulary, this.diary.summary()), founderId);
  }
}
