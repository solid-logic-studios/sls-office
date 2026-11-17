import type { Findings, Snapshot } from '../../contract/snapshot.ts';
import type { AmbientBed, Layout, SynthSound, Theme } from '../../contract/theme.ts';
import type { CharacterView } from '../../engine/engine.ts';
import type { EventBus } from '../../engine/event-bus.ts';
import { localHour } from '../clock.ts';
import type { Audition } from './auditions.ts';
import { EasterEggs } from './easter-eggs.ts';
import type { MuteStorage } from './mute-preference.ts';
import { ambientMix, busyness, labLoad } from './ambient-mix.ts';
import { DEFAULT_QUIET_HOURS, isQuiet, type QuietHours } from './quiet-hours.ts';
import { soundSeconds, type AmbientMix, type PlayOptions, type SoundOutput } from './sound-output.ts';
import type { SpeechOutput } from './speech-output.ts';
import { SpeechQueue } from './speech-queue.ts';
import { StageEffects } from './stage-effects.ts';
import { statusAnnouncement } from './status-announcement.ts';
import { announcerVoice, spokenLine, voiceFor } from './voice-casting.ts';

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
  /** Where spoken lines go. Defaults to silence, so a Soundboard without one keeps every line to its bubble. */
  speech?: SpeechOutput;
  /** The local time of day as a fractional hour, 0 to 24. Injected so tests can move it; defaults to the wall clock. */
  hour?: () => number;
  /** When the Office keeps quiet (ADR 0004). Defaults to `DEFAULT_QUIET_HOURS`. */
  quietHours?: QuietHours;
  /** Epoch milliseconds, for the uptime streak. Injected so tests can move it; defaults to `Date.now()`. */
  wallNow?: () => number;
  /** Where the uptime streak is remembered. Defaults to none, so it lasts only for the page load. */
  storage?: MuteStorage | null;
}

/** The effect and ambient channels' level while an Alarm sounds, so the Alarm cuts through. */
export const ALARM_DUCK = 0.25;

/** The Alarm's volume during quiet hours: still heard, but not startling. */
export const QUIET_ALARM_VOLUME = 0.5;

/** The ambient channel's level while a line is spoken, so the speaker can be heard. */
export const SPEECH_DUCK = 0.5;

/** A `SpeechOutput` that says nothing: every line ends at once. */
const SILENT_SPEECH: SpeechOutput = {
  speak: (_line, onEnd) => onEnd(),
  stop: () => undefined,
  setVolume: () => undefined,
};

/** The Soundscape's Alarm-channel sounds. */
type AlarmCue = 'alarm' | 'reminder' | 'allClear';
/** Everything the Soundboard may sound: the Alarm-channel cues, the stage effects, speech and the ambient bed. */
type Sounding = AlarmCue | 'effect' | 'speech' | 'ambient';
const FULL_LEVEL = 1;
/** An audition plays dead centre and at full strength, as an effect from a stranger does. */
const AUDITION_PLACEMENT: Pick<PlayOptions, 'volume' | 'pan'> = { volume: 1, pan: 0 };
/** Passed with a `null` bed, which has no mix to speak of. */
const SILENT_MIX: AmbientMix = { room: 0, hum: 0, keysPerSecond: 0 };

/** How long a critical finding stays open before the Reminder sounds, and between Reminders. */
export const REMINDER_MS = 10 * 60 * 1000;

/**
 * Turns what the lab does into sound (ADR 0004). It listens to the Engine's bus and reads the Theme's
 * Soundscape; the Engine stays silent. It sounds the Alarm, the Reminder and the All-clear (channel
 * `alarm`), at most one per Snapshot, in that order of priority. Stage effects (channel `effect`) come
 * from `StageEffects` and the easter eggs (also effects) from `EasterEggs`, and the ambient bed (channel
 * `ambient`) follows the lab's load and the workers' moods; both are ducked while an Alarm sounds. Speech
 * (the `speech` event on the bus) goes through a `SpeechQueue` to the `SpeechOutput`: it ducks the bed, and
 * an Alarm cuts it off and holds it back. During quiet hours only the Alarm sounds, at half volume; the bed,
 * effects, speech, Reminder and All-clear stay silent until they end. The master `volume` scales every
 * channel, and `audition` plays any one sound on
 * request for the `?sim` Sound panel.
 */
export class Soundboard {
  private readonly unsubscribe: readonly (() => void)[];
  private readonly now: () => number;
  private readonly later: (callback: () => void, ms: number) => void;
  private readonly hour: () => number;
  private readonly quietHours: QuietHours;
  private readonly effects: StageEffects;
  private readonly eggs: EasterEggs;
  private readonly speech: SpeechQueue;
  private readonly speechOutput: SpeechOutput;
  private alarmPending = false;
  private allClearPending = false;
  /** `null` until the first Snapshot, so an already open finding on page load is not an edge. */
  private lastCrit: number | null = null;
  /** When the open critical finding last sounded (Alarm or Reminder), or when it was first seen. */
  private reminderSince = 0;

  private isMuted = false;
  /** Set from the `?sim` Sound panel so quiet hours can be tested by day. Not remembered. */
  private ignoringQuietHours = false;
  private level = FULL_LEVEL;
  /** Whether it is quiet hours, as of construction and each Snapshot, so entering them can be told. */
  private quiet: boolean;
  /** True while an Alarm is sounding, so the lower channels are ducked. */
  private alarmSounding = false;
  /** True while a line is being spoken, so the bed is ducked. */
  private speaking = false;
  /** Counts Alarms, so only the latest one's timer restores the levels. */
  private duckGeneration = 0;
  /** The bed and mix last worked out from a Snapshot, so unmuting can bring the bed straight back. */
  private lastAmbient: { bed: AmbientBed; mix: AmbientMix } | null = null;
  /** The Snapshot last passed to `endSnapshot`, which the spoken status reads the rooms from. */
  private lastSnapshot: Snapshot | null = null;
  /** Whether the output has been told to run a bed, so a Theme without one is only switched off once. */
  private bedOn = false;

  constructor(
    private readonly source: SoundSource,
    private readonly output: SoundOutput,
    options: SoundboardOptions = {},
  ) {
    this.now = options.now ?? (() => performance.now());
    this.later = options.later ?? ((callback, ms) => void setTimeout(callback, ms));
    this.hour = options.hour ?? (() => localHour(new Date()));
    this.quietHours = options.quietHours ?? DEFAULT_QUIET_HOURS;
    this.quiet = isQuiet(this.quietHours, this.hour());
    this.speechOutput = options.speech ?? SILENT_SPEECH;
    this.speech = new SpeechQueue(this.speechOutput, {
      now: this.now,
      later: this.later,
      onSpeaking: (speaking) => {
        this.speaking = speaking;
        this.applyLevels();
      },
    });
    this.effects = new StageEffects(source, (sound, placement) => this.playEffect(sound, placement), this.now);
    this.eggs = new EasterEggs(source, (sound, placement) => this.playEffect(sound, placement), {
      now: this.now,
      later: this.later,
      hour: this.hour,
      wallNow: options.wallNow ?? (() => Date.now()),
      storage: options.storage ?? null,
    });
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
      bus.subscribe('speech', (event) => this.say(event.speakerId, event.text)),
    ];
  }

  /** While muted nothing plays, and a sound or line that falls due meanwhile is lost, not queued. Muting cuts off what is playing, a spoken line included. */
  get muted(): boolean {
    return this.isMuted;
  }

  set muted(value: boolean) {
    this.isMuted = value;
    if (value) {
      this.output.stop('alarm');
      this.silenceBelowAlarm();
    } else if (this.lastAmbient !== null && this.mayPlay('ambient')) {
      this.switchBed(this.lastAmbient);
    }
  }

  /** The master volume, 0 to 1, for every channel: Web Audio, clips and `speechSynthesis` alike. */
  get volume(): number {
    return this.level;
  }

  set volume(value: number) {
    if (Number.isNaN(value)) return;
    this.level = Math.min(FULL_LEVEL, Math.max(0, value));
    this.output.setMaster(this.level);
    this.speechOutput.setVolume(this.level);
  }

  /**
   * While true quiet hours have no effect: everything may play, the Alarm sounds at full volume, and
   * entering them cuts nothing off. Turning it off during quiet hours silences everything under the Alarm.
   */
  get ignoreQuietHours(): boolean {
    return this.ignoringQuietHours;
  }

  set ignoreQuietHours(value: boolean) {
    this.ignoringQuietHours = value;
    this.followClock();
    if (this.hushed) this.silenceBelowAlarm();
    else if (this.lastAmbient !== null && this.mayPlay('ambient')) this.switchBed(this.lastAmbient);
  }

  /** Plays one thing from the Sound panel now, through the same gates as the real thing (mute, quiet hours). */
  audition(audition: Audition): void {
    switch (audition.kind) {
      case 'cue':
        this.play(audition.cue);
        break;
      case 'effect': {
        const sound = this.source.theme.soundscape?.effects?.[audition.effect];
        if (sound !== undefined) this.playEffect(sound, AUDITION_PLACEMENT);
        break;
      }
      case 'voice': {
        const { voice, text } = audition;
        if (this.mayPlay('speech')) this.speech.sayNow({ text, voice, pitch: voice.pitch, rate: voice.rate });
        break;
      }
    }
  }

  /**
   * Call right after `engine.accept(snapshot)`, with that same Snapshot. Moves the ambient bed to the lab's
   * load, then sounds at most one thing: Alarm, then All-clear, then Reminder. It is also where quiet hours
   * are noticed: entering them cuts off what is playing, leaving them lets the bed come back.
   */
  endSnapshot(snapshot: Snapshot): void {
    this.lastSnapshot = snapshot;
    this.followClock();
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

    if (alarmDue) {
      this.play('alarm');
      this.eggs.alarmed();
    } else if (allClearDue) this.play('allClear');
    else if (reminderDue) this.play('reminder');
    this.eggs.endSnapshot();
  }

  /**
   * Speaks the lab's status in the announcing founder's Voice (ADR 0004): rooms up and down, who is worst
   * off and any critical findings, stitched from the Theme's vocabulary. It says nothing before the first
   * Snapshot or without a vocabulary, and otherwise follows `announce`.
   */
  announceStatus(): void {
    const vocabulary = this.source.theme.soundscape?.vocabulary;
    const snapshot = this.lastSnapshot;
    if (vocabulary === undefined || snapshot === null) return;
    this.announce(
      statusAnnouncement(vocabulary, {
        vmsUp: snapshot.vms.filter((vm) => vm.up).length,
        vmsDown: snapshot.vms.filter((vm) => !vm.up).length,
        characters: this.source.characters(),
        findings: this.source.findings,
      }),
    );
  }

  /** Whether a spoken line may sound now: neither muted nor in quiet hours. The Standup asks before it calls anyone. */
  get maySpeak(): boolean {
    return this.mayPlay('speech');
  }

  /**
   * Says an Announcement's pieces in a Voice: the founder `speakerId`'s own, else the announcing founder's
   * (the Theme's first, or its default Voice). It waits for the line being said but skips the gap, and says
   * nothing without Voices or while muted or in quiet hours.
   */
  announce(pieces: readonly string[], speakerId?: string): void {
    const { theme } = this.source;
    const voices = theme.soundscape?.voices;
    const voice =
      speakerId === undefined || voices === undefined
        ? announcerVoice(theme)
        : voiceFor(voices, { id: speakerId, part: 'founder' });
    if (voice === undefined || !this.mayPlay('speech')) return;
    this.speech.announce({ text: pieces.join(' '), pieces, voice, pitch: voice.pitch, rate: voice.rate });
  }

  dispose(): void {
    for (const stop of this.unsubscribe) stop();
    this.effects.dispose();
    this.eggs.dispose();
    this.speech.interrupt();
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

  /**
   * Reads the clock. On entering quiet hours it cuts off the line, effects and bed in flight, as muting does.
   * `endSnapshot` calls it; the page also calls it on a poll with no fresh Snapshot, so a lab that has gone
   * quiet (a stale or missing Snapshot) still cannot leave the bed humming through the night.
   */
  followClock(): void {
    const quiet = isQuiet(this.quietHours, this.hour());
    const entering = quiet && !this.quiet;
    this.quiet = quiet;
    if (entering && !this.ignoringQuietHours) this.silenceBelowAlarm();
  }

  /** Whether quiet hours are in force: it is quiet and they are not being ignored. */
  private get hushed(): boolean {
    return this.quiet && !this.ignoringQuietHours;
  }

  /** Cuts off everything under the Alarm channel: effects, the line being said (and those waiting) and the bed. */
  private silenceBelowAlarm(): void {
    this.output.stop('effect');
    this.speech.interrupt();
    this.switchBed(null);
  }

  /**
   * The one place that decides whether a sound may play now. Mute silences everything; quiet hours
   * silence everything but the Alarm.
   */
  private mayPlay(sounding: Sounding): boolean {
    if (this.isMuted) return false;
    return !this.hushed || sounding === 'alarm';
  }

  /** Works out the bed's mix from the Snapshot and the cast, and sends it unless muted or quiet. No bed, none. */
  private followLab(snapshot: Snapshot): void {
    const bed = this.source.theme.soundscape?.ambient;
    this.lastAmbient =
      bed === undefined ? null : { bed, mix: ambientMix(bed, labLoad(snapshot), busyness(this.source.characters())) };
    if (this.mayPlay('ambient')) this.switchBed(this.lastAmbient);
  }

  /** The one place the ambient bed is set. `null` switches it off, and only tells the output if it was on. */
  private switchBed(target: { bed: AmbientBed; mix: AmbientMix } | null): void {
    if (target !== null) {
      this.output.ambient(target.bed, target.mix);
      this.bedOn = true;
    } else if (this.bedOn) {
      this.output.ambient(null, SILENT_MIX);
      // Key presses already scheduled ahead would otherwise tick on for a moment.
      this.output.stop('ambient');
      this.bedOn = false;
    }
  }

  /** The one place an Alarm-channel sound plays: silent while muted, and in quiet hours bar the Alarm (half volume). */
  private play(name: AlarmCue): void {
    if (!this.mayPlay(name)) return;
    const sound = this.source.theme.soundscape?.[name];
    if (sound === undefined) return;
    const volume = this.hushed ? QUIET_ALARM_VOLUME : FULL_LEVEL;
    this.output.play(sound, { channel: 'alarm', volume, pan: 0 });
    if (name === 'alarm') this.duckForAlarm(sound);
  }

  /** Voices a line in the speaker's Voice, if the Theme has Voices and it is neither muted nor quiet hours. */
  private say(speakerId: string, text: string): void {
    const voices = this.source.theme.soundscape?.voices;
    if (!this.mayPlay('speech') || voices === undefined) return;
    const speaker = this.source.characters().find((character) => character.id === speakerId);
    // A hidden speaker gets no bubble, so it gets no voice either.
    if (speaker?.visible === false) return;
    this.speech.enqueue(spokenLine(text, voiceFor(voices, speaker), speakerId, this.source.theme.soundscape?.spoken));
  }

  private playEffect(sound: SynthSound, placement: Pick<PlayOptions, 'volume' | 'pan'>): void {
    if (!this.mayPlay('effect')) return;
    this.output.play(sound, { channel: 'effect', ...placement });
  }

  /**
   * Lowers the lower channels and silences speech for the Alarm's length. A later Alarm takes over the
   * restore, so the first never cuts it short.
   */
  private duckForAlarm(alarm: SynthSound): void {
    this.alarmSounding = true;
    this.speech.interrupt();
    this.speech.hold(true);
    this.applyLevels();
    this.duckGeneration += 1;
    const generation = this.duckGeneration;
    this.later(
      () => {
        if (generation !== this.duckGeneration) return;
        this.alarmSounding = false;
        this.applyLevels();
        this.speech.hold(false);
      },
      soundSeconds(alarm) * 1000,
    );
  }

  /** The one place the ducked channels' levels are worked out from state. The bed takes the lower of the Alarm's and speech's ducks. */
  private applyLevels(): void {
    const alarmLevel = this.alarmSounding ? ALARM_DUCK : FULL_LEVEL;
    const speechLevel = this.speaking ? SPEECH_DUCK : FULL_LEVEL;
    this.output.setLevel('effect', alarmLevel);
    this.output.setLevel('ambient', Math.min(alarmLevel, speechLevel));
  }
}
