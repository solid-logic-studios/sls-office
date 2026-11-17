import type { MuteStorage } from './mute-preference.ts';

/** The local hour the Standup falls due: from 09:00 to 09:59. */
export const STANDUP_HOUR = 9;

export const STANDUP_KEY = 'sls-office.standup';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The local calendar date as `YYYY-MM-DD`. */
function dateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Local days since 1 January 1970, counting the local calendar date, so the number changes at local midnight. */
export function localDayNumber(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

/**
 * Says when the Standup is due: once a day, in the 09:00 hour. The day it last ran is saved so a reload the
 * same morning does not run it again, and kept in memory too, so storage that is missing or throws
 * (private windows, blocked site data) still holds for the page load.
 */
export class StandupSchedule {
  private lastDone: string | null = null;

  constructor(private readonly storage: MuteStorage | null) {}

  /** Whether it is the 09:00 hour and the Standup has not run today. */
  due(now: Date): boolean {
    return now.getHours() === STANDUP_HOUR && (this.lastDone ?? this.saved()) !== dateKey(now);
  }

  /** Notes that today's Standup has had its turn, whether it was spoken or skipped. */
  markDone(now: Date): void {
    this.lastDone = dateKey(now);
    try {
      this.storage?.setItem(STANDUP_KEY, this.lastDone);
    } catch {
      // Not saved; it still holds for this page load.
    }
  }

  private saved(): string | null {
    try {
      return this.storage?.getItem(STANDUP_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
