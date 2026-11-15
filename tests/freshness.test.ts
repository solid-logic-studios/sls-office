import { describe, expect, it } from 'vitest';
import { isStale } from '../src/page/freshness.ts';

const now = new Date('2026-11-16T09:01:00Z');

describe('isStale', () => {
  it('treats a recent snapshot as fresh', () => {
    expect(isStale({ at: '2026-11-16T09:00:30Z' }, now)).toBe(false);
  });
  it('treats exactly the max age as fresh', () => {
    expect(isStale({ at: '2026-11-16T09:00:00Z' }, now)).toBe(false);
  });
  it('treats an old snapshot as stale', () => {
    expect(isStale({ at: '2026-11-16T08:59:00Z' }, now)).toBe(true);
  });
  it('honours a custom max age', () => {
    expect(isStale({ at: '2026-11-16T09:00:30Z' }, now, 10_000)).toBe(true);
  });
  it('treats an unparseable time as stale', () => {
    expect(isStale({ at: 'not a date' }, now)).toBe(true);
  });
  it('treats a slightly future-dated snapshot as fresh', () => {
    expect(isStale({ at: '2026-11-16T09:01:05Z' }, now)).toBe(false);
  });
});
