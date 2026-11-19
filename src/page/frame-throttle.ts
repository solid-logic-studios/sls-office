/** The frame request pair `Loop` takes. */
export type RequestFrame = (callback: (timeMs: number) => void) => number;
export type CancelFrame = (handle: number) => void;

export interface FramePair {
  readonly requestFrame: RequestFrame;
  readonly cancelFrame: CancelFrame;
}

/** Slack under the interval, so display jitter does not push a frame to the next tick (60 Hz still gives every third). */
const TOLERANCE_MS = 4;

/**
 * Wraps a frame request pair so the callback runs at most once per `intervalMs` (about 20 a second at 50 ms).
 * Frames in between are re-requested and skipped. The real timestamp is passed through, so `Loop`'s
 * `dt` still sums to real time. The handle returned is the wrapper's own and stays valid across re-requests.
 */
export function throttleFrames(inner: FramePair, intervalMs: number): FramePair {
  let lastMs: number | null = null;
  let issued = 0;
  /** The wrapper handle awaiting a frame, and the underlying handle that will deliver it. */
  let pending: { readonly handle: number; underlying: number } | null = null;

  const requestFrame: RequestFrame = (callback) => {
    issued += 1;
    const waiting = { handle: issued, underlying: 0 };
    pending = waiting;
    const onFrame = (timeMs: number): void => {
      if (lastMs !== null && timeMs - lastMs < intervalMs - TOLERANCE_MS) {
        waiting.underlying = inner.requestFrame(onFrame);
        return;
      }
      lastMs = timeMs;
      pending = null;
      callback(timeMs);
    };
    waiting.underlying = inner.requestFrame(onFrame);
    return waiting.handle;
  };

  const cancelFrame: CancelFrame = (handle) => {
    if (pending === null || pending.handle !== handle) return;
    inner.cancelFrame(pending.underlying);
    pending = null;
  };

  return { requestFrame, cancelFrame };
}
