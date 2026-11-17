import type { SynthSound } from '../../src/contract/theme.ts';
import type { SoundOutput } from '../../src/page/audio/sound-output.ts';

export interface PlayedSound {
  sound: SynthSound;
  options: { volume: number; pan: number };
}

/** A `SoundOutput` that remembers what it was asked to play. */
export class RecordingSoundOutput implements SoundOutput {
  readonly played: PlayedSound[] = [];

  play(sound: SynthSound, options: { volume: number; pan: number }): void {
    this.played.push({ sound, options });
  }

  clear(): void {
    this.played.length = 0;
  }
}
