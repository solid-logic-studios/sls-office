import type { AmbientBed, MusicScore, SynthNote, SynthSound } from '../../contract/theme.ts';

/** How long a note takes, in seconds, including the silence after it. */
export function noteSeconds(note: SynthNote): number {
  return note.attack + note.sustain + note.decay + (note.gap ?? 0);
}

/** How long a sound lasts, in seconds: its notes one after another. */
export function soundSeconds(sound: SynthSound): number {
  return sound.notes.reduce((total, note) => total + noteSeconds(note), 0);
}

/**
 * The ranked Web Audio channels (ADR 0004): Alarm, then effect, then ambient. Each has its own level, so
 * one can be ducked under another without touching what is already playing.
 */
export type Channel = 'alarm' | 'effect' | 'ambient';

/**
 * How loud the ambient bed is right now, worked out by the Soundboard from the lab: each layer's volume
 * (0 to 1) and how many key presses a second.
 */
export interface AmbientMix {
  room: number;
  hum: number;
  keysPerSecond: number;
}

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
  /** Moves the master level (0 to 1, 1 is normal) every channel passes through to `level`, gliding like `setLevel`. */
  setMaster(level: number): void;
  /** Cuts off whatever the channel is playing now. Later sounds on it play as normal. */
  stop(channel: Channel): void;
  /**
   * Runs the ambient bed on the `ambient` channel at `mix`, starting it if it is not running and gliding
   * to the new mix if it is (no clicks). `null` fades the bed out and stops it.
   */
  ambient(bed: AmbientBed | null, mix: AmbientMix): void;
  /**
   * Plays the music on the `ambient` channel at lab `load` (0 to 1): starts it with a fade-in if it is not
   * running, and only moves its tempo target if it is. `null` fades it out and stops it.
   */
  music(score: MusicScore | null, load: number): void;
}
