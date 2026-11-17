import type { SynthSound } from '../../contract/theme.ts';

/** Where the Soundboard sends sound: Web Audio on the page, a recording fake in tests. */
export interface SoundOutput {
  /** `volume` is 0 to 1 and `pan` is -1 (left) to 1 (right). */
  play(sound: SynthSound, options: { volume: number; pan: number }): void;
}
