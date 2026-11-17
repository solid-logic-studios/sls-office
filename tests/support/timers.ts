/** A timer a fake `later` has been asked to set. */
export interface PendingTimer {
  callback: () => void;
  ms: number;
}

/** The pending timers set for `seconds` (the Alarm's length, say), whatever else is waiting on `later`. */
export function timersFor(timers: readonly PendingTimer[], seconds: number): PendingTimer[] {
  return timers.filter((timer) => Math.abs(timer.ms - seconds * 1000) < 1);
}
