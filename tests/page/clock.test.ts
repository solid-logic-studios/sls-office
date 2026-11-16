import { describe, expect, it } from 'vitest';
import { formatHour, localHour } from '../../src/page/clock.ts';

describe('formatHour', () => {
  it('pads both parts to two digits', () => {
    expect(formatHour(0)).toBe('00:00');
    expect(formatHour(2.5)).toBe('02:30');
  });

  it('floors the minutes rather than rounding up to the next hour', () => {
    expect(formatHour(23.99)).toBe('23:59');
  });
});

describe('localHour', () => {
  it('is the hours plus the minutes as a fraction', () => {
    expect(localHour(new Date(2026, 0, 1, 14, 45))).toBe(14.75);
    expect(localHour(new Date(2026, 0, 1, 0, 0))).toBe(0);
  });
});
