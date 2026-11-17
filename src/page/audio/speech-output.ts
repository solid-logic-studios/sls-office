import type { Voice } from '../../contract/theme.ts';

/** One line to say: the text, the speaker's Voice, and the pitch and rate this speaker uses it at. */
export interface SpokenLine {
  text: string;
  voice: Voice;
  /** 0 to 2, 1 is normal. */
  pitch: number;
  /** 0.5 to 2, 1 is normal. */
  rate: number;
}

/**
 * Where the Soundboard sends speech: `speechSynthesis` on the page, a recording fake in tests. Separate
 * from `SoundOutput` because speech is not Web Audio and later phases swap in pre-rendered clips.
 */
export interface SpeechOutput {
  /** Says `line`, and calls `onEnd` exactly once when it finishes, is cut off or fails to start. */
  speak(line: SpokenLine, onEnd: () => void): void;
  /** Cuts off the line being said now, if any (its `onEnd` still fires). */
  stop(): void;
  /** Sets how loud lines are (0 to 1, 1 is normal), for the line being said now and those after it. */
  setVolume(level: number): void;
}
