/** The local time of day as a fractional hour, 0 to 24. */
export function localHour(now: Date): number {
  return now.getHours() + now.getMinutes() / 60;
}

const MINUTES_PER_DAY = 24 * 60;

/** A fractional hour as `HH:MM`, rounded to the nearest minute (so 14 + 2/60 is 14:02) and wrapping 24:00 to 00:00. */
export function formatHour(hour: number): string {
  const total = Math.round(hour * 60) % MINUTES_PER_DAY;
  const whole = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
