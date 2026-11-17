import type { Theme } from '../../contract/theme.ts';
import type { EventBus } from '../../engine/event-bus.ts';
import type { OfficeDiary } from './office-diary.ts';
import { standupAnnouncement } from './standup-announcement.ts';
import { localDayNumber, type StandupSchedule } from './standup-schedule.ts';

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
 * hours in their own Voice. The day is marked done as soon as it falls due, so a Standup that cannot be
 * spoken (muted, quiet hours, no founders or vocabulary) is skipped for the day and not retried.
 */
export class Standup {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly stage: StandupStage,
    private readonly voice: StandupVoice,
    private readonly diary: OfficeDiary,
    private readonly schedule: StandupSchedule,
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
    return this.stage.callStandup(founder.id);
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** The founder has reached the front: say the day's summary in their Voice. */
  private give(founderId: string): void {
    const vocabulary = this.stage.theme.soundscape?.vocabulary;
    if (vocabulary === undefined) return;
    this.voice.announce(standupAnnouncement(vocabulary, this.diary.summary()), founderId);
  }
}
