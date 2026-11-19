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
  /**
   * `Loop` holds one request at a time, so one slot is enough. `handle` is the underlying handle of the
   * first request, which is unique and stays the wrapper's handle; `underlying` follows each re-request.
   */
  let slot: { readonly handle: number; underlying: number } | null = null;

  const requestFrame: RequestFrame = (callback) => {
    const onFrame = (timeMs: number): void => {
      if (lastMs !== null && timeMs - lastMs < intervalMs - TOLERANCE_MS) {
        current.underlying = inner.requestFrame(onFrame);
        return;
      }
      lastMs = timeMs;
      slot = null;
      callback(timeMs);
    };
    const first = inner.requestFrame(onFrame);
    const current = { handle: first, underlying: first };
    slot = current;
    return first;
  };

  const cancelFrame: CancelFrame = (handle) => {
    if (slot === null || slot.handle !== handle) return;
    inner.cancelFrame(slot.underlying);
    slot = null;
  };

  return { requestFrame, cancelFrame };
}
