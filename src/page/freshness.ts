import type { Snapshot } from '../contract/snapshot.ts';

export const DEFAULT_MAX_AGE_MS = 60_000;

/** True when `at` is unparseable or more than `maxAgeMs` from `now`, in the past or the future (clock skew). */
export function isStale(snapshot: Pick<Snapshot, 'at'>, now: Date, maxAgeMs: number = DEFAULT_MAX_AGE_MS): boolean {
  const takenAt = Date.parse(snapshot.at);
  if (Number.isNaN(takenAt)) return true;
  return Math.abs(now.getTime() - takenAt) > maxAgeMs;
}
