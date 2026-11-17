import type { AmbientBed, SynthSound } from '../../src/contract/theme.ts';
import type { AmbientMix, Channel, PlayOptions, SoundOutput } from '../../src/page/audio/sound-output.ts';

export interface PlayedSound {
  sound: SynthSound;
  options: PlayOptions;
}

export interface LevelChange {
  channel: Channel;
  level: number;
}

export interface AmbientCall {
  /** `null` is the bed being switched off. */
  bed: AmbientBed | null;
  mix: AmbientMix;
}

/** A `SoundOutput` that remembers what it was asked to play, to set and to stop. */
export class RecordingSoundOutput implements SoundOutput {
  readonly played: PlayedSound[] = [];
  readonly levels: LevelChange[] = [];
  readonly stops: Channel[] = [];
  readonly ambients: AmbientCall[] = [];

  /** Just the Alarm channel's plays: the Alarm, Reminder and All-clear, without the stage effects around them. */
  get alarms(): PlayedSound[] {
    return this.played.filter((play) => play.options.channel === 'alarm');
  }

  play(sound: SynthSound, options: PlayOptions): void {
    this.played.push({ sound, options });
  }

  setLevel(channel: Channel, level: number): void {
    this.levels.push({ channel, level });
  }

  stop(channel: Channel): void {
    this.stops.push(channel);
  }

  ambient(bed: AmbientBed | null, mix: AmbientMix): void {
    this.ambients.push({ bed, mix });
  }

  clear(): void {
    this.played.length = 0;
    this.levels.length = 0;
    this.stops.length = 0;
    this.ambients.length = 0;
  }
}
