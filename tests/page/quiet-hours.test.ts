import { describe, expect, it } from 'vitest';
import { DEFAULT_QUIET_HOURS, isQuiet, parseQuietHours } from '../../src/page/audio/quiet-hours.ts';

const parse = (value: string | null): ReturnType<typeof parseQuietHours> =>
  parseQuietHours(new URLSearchParams(value === null ? '' : { quiet: value }));

describe('parseQuietHours', () => {
  it('defaults to 22:00 to 07:00 when ?quiet is missing', () => {
    expect(parse(null)).toEqual({ start: 22, end: 7 });
    expect(DEFAULT_QUIET_HOURS).toEqual({ start: 22, end: 7 });
  });

  it('reads an override', () => {
    expect(parse('20-6')).toEqual({ start: 20, end: 6 });
    expect(parse('13-15')).toEqual({ start: 13, end: 15 });
    expect(parse('0-23')).toEqual({ start: 0, end: 23 });
  });

  it('trims whitespace around the whole value', () => {
    expect(parse(' 21-5 ')).toEqual({ start: 21, end: 5 });
  });

  it.each(['25-7', '7-24', 'abc', '22', '22-7-1', '-1-5', '7.5-9', '', '22-', '-7', '22 - 7', '+5-6'])(
    'falls back to the default for %j',
    (value) => {
      expect(parse(value)).toEqual(DEFAULT_QUIET_HOURS);
    },
  );

  it('treats 0-0 as valid, so there are no quiet hours', () => {
    expect(parse('0-0')).toEqual({ start: 0, end: 0 });
  });
});

describe('isQuiet', () => {
  it('covers a window that crosses midnight, start included and end excluded', () => {
    expect(isQuiet(DEFAULT_QUIET_HOURS, 22)).toBe(true);
    expect(isQuiet(DEFAULT_QUIET_HOURS, 21.99)).toBe(false);
    expect(isQuiet(DEFAULT_QUIET_HOURS, 23.5)).toBe(true);
    expect(isQuiet(DEFAULT_QUIET_HOURS, 0)).toBe(true);
    expect(isQuiet(DEFAULT_QUIET_HOURS, 6.99)).toBe(true);
    expect(isQuiet(DEFAULT_QUIET_HOURS, 7)).toBe(false);
    expect(isQuiet(DEFAULT_QUIET_HOURS, 12)).toBe(false);
  });

  it('covers a window that does not cross midnight', () => {
    const afternoon = { start: 13, end: 15 };
    expect(isQuiet(afternoon, 12.99)).toBe(false);
    expect(isQuiet(afternoon, 13)).toBe(true);
    expect(isQuiet(afternoon, 14.5)).toBe(true);
    expect(isQuiet(afternoon, 15)).toBe(false);
    expect(isQuiet(afternoon, 23)).toBe(false);
  });

  it('is never quiet when start equals end', () => {
    for (const hour of [0, 6, 12, 22, 23.99]) expect(isQuiet({ start: 0, end: 0 }, hour)).toBe(false);
  });
});
