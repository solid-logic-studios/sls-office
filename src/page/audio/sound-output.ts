import type { SynthSound } from '../../contract/theme.ts';

/**
 * The ranked Web Audio channels (ADR 0004): an Alarm outranks an effect. Each has its own level, so one
 * can be ducked under another without touching what is already playing.
 */
export type Channel = 'alarm' | 'effect';

export interface PlayOptions {
  channel: Channel;
  /** 0 to 1. */
  volume: number;
  /** -1 (left) to 1 (right). */
  pan: number;
}

/** Where the Soundboard sends sound: Web Audio on the page, a recording fake in tests. */
export interface SoundOutput {
  play(sound: SynthSound, options: PlayOptions): void;
  /** Moves a channel's level (0 to 1, 1 is normal) to `level`, gliding so the change never clicks. */
  setLevel(channel: Channel, level: number): void;
  /** Cuts off whatever the channel is playing now. Later sounds on it play as normal. */
  stop(channel: Channel): void;
}
