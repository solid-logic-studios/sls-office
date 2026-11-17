/**
 * A daily window when the Office keeps its sound down (ADR 0004). Whole local hours, 0 to 23: it runs from
 * `start`:00 up to but not including `end`:00, and wraps past midnight when `start` is later than `end`.
 * Equal `start` and `end` is an empty window, so there are no quiet hours at all.
 */
export interface QuietHours {
  start: number;
  end: number;
}

/** 22:00 to 07:00 local, so a lab left running overnight does not wake the room. */
export const DEFAULT_QUIET_HOURS: QuietHours = { start: 22, end: 7 };

const LAST_HOUR = 23;
const WINDOW = /^(\d{1,2})-(\d{1,2})$/;

/**
 * Reads `?quiet=22-7` from the page's query: exactly two whole hours, 0 to 23, joined by `-`. A missing
 * or malformed value gives `DEFAULT_QUIET_HOURS`, so a typo never leaves a screen without its quiet
 * hours. `?quiet=0-0` is valid and turns quiet hours off.
 */
export function parseQuietHours(query: URLSearchParams): QuietHours {
  const match = WINDOW.exec(query.get('quiet')?.trim() ?? '');
  if (match === null) return DEFAULT_QUIET_HOURS;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (start > LAST_HOUR || end > LAST_HOUR) return DEFAULT_QUIET_HOURS;
  return { start, end };
}

/** Whether `hour`, a fractional local hour from 0 to 24 (as `localHour` gives), falls inside the window. */
export function isQuiet(window: QuietHours, hour: number): boolean {
  const { start, end } = window;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
