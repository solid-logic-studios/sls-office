/** The local time of day as a fractional hour, 0 to 24. */
export function localHour(now: Date): number {
  return now.getHours() + now.getMinutes() / 60;
}

/** A fractional hour as `HH:MM`, with the minutes floored. */
export function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.floor((hour - whole) * 60);
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
