import type { ClipPlayer } from './clip-player.ts';

/** A clip whose length is still unknown after this long never loaded; it fails, so the fallback speaks the line. */
const LOAD_ALLOWANCE_MS = 8000;
/** Slack added to a clip's own length, once known, before it is given up on. */
const PLAY_SLACK_MS = 3000;

/** Plays clips through an `Audio` element. Where `Audio` is missing, every clip fails at once. */
export class HtmlAudioClipPlayer implements ClipPlayer {
  /** Ends the clip being played: clears its watchdog and calls its `onEnd`, once. */
  private finishCurrent: ((failed: boolean) => void) | null = null;

  play(url: string, playbackRate: number, onEnd: (failed: boolean) => void): void {
    if (typeof Audio === 'undefined') {
      onEnd(true);
      return;
    }
    const audio = new Audio(url);
    // Speed and pitch move together: the nudge is a pitch shift, and it is small enough to keep speech natural.
    audio.preservesPitch = false;
    audio.playbackRate = playbackRate;
    let ended = false;
    let watchdog: ReturnType<typeof setTimeout>;
    const finish = (failed: boolean): void => {
      if (ended) return;
      ended = true;
      clearTimeout(watchdog);
      audio.pause();
      if (this.finishCurrent === finish) this.finishCurrent = null;
      onEnd(failed);
    };
    // Before the length is known the clip never loaded, so it fails and the fallback speaks the line. After it,
    // a browser that never fires `ended` is not a failure (the clip played): the line just ends, so the queue
    // does not wait for it all day.
    const arm = (ms: number, failed: boolean): void => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => finish(failed), ms);
    };
    arm(LOAD_ALLOWANCE_MS, true);
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) arm((audio.duration / playbackRate) * 1000 + PLAY_SLACK_MS, false);
    });
    audio.addEventListener('ended', () => finish(false));
    audio.addEventListener('error', () => finish(true));
    this.finishCurrent = finish;
    // A rejection covers `NotAllowedError`, which the browser raises before the first gesture.
    audio.play().catch(() => finish(true));
  }

  /** Pauses the clip and ends it here, so its watchdog can never end a later one. */
  stop(): void {
    this.finishCurrent?.(false);
  }
}
