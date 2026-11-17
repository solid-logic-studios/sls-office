import type { ClipPlayer } from '../../src/page/audio/clip-player.ts';

/** A `ClipPlayer` that remembers what it was asked to play, and lets the test end or fail a clip by hand. */
export class RecordingClipPlayer implements ClipPlayer {
  /** Every clip started, in order. */
  readonly played: { url: string; playbackRate: number }[] = [];
  /** How many times `stop()` was called. */
  stops = 0;
  private onEnd: ((failed: boolean) => void) | null = null;

  /** Whether a clip is playing now. */
  get playing(): boolean {
    return this.onEnd !== null;
  }

  play(url: string, playbackRate: number, onEnd: (failed: boolean) => void): void {
    this.played.push({ url, playbackRate });
    this.onEnd = onEnd;
  }

  /** Like the real thing, cutting a clip off still reports it ended, not failed. */
  stop(): void {
    this.stops += 1;
    this.finish(false);
  }

  /** Ends the current clip as if it had played in full. */
  finish(failed = false): void {
    const onEnd = this.onEnd;
    this.onEnd = null;
    onEnd?.(failed);
  }
}
