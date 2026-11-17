/**
 * Where pre-rendered clips are played: an `Audio` element on the page, a recording fake in tests. Separate
 * from `SoundOutput` (Web Audio) because a clip is one file, played once, that can be cut off (ADR 0004).
 */
export interface ClipPlayer {
  /**
   * Plays the clip at `url`, sped up or slowed down (and so pitched up or down) by `playbackRate`, and
   * calls `onEnd` exactly once: `failed` is false when it finished or was cut off, true when it could not
   * load or play.
   */
  play(url: string, playbackRate: number, onEnd: (failed: boolean) => void): void;
  /** Cuts off the clip being played now, if any (its `onEnd` still fires, with `failed` false). */
  stop(): void;
}
