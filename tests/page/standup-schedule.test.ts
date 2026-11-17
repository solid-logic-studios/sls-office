import { describe, expect, it } from 'vitest';
import type { MuteStorage } from '../../src/page/audio/mute-preference.ts';
import { STANDUP_KEY, StandupSchedule, localDayNumber } from '../../src/page/audio/standup-schedule.ts';

const at = (day: number, hour: number, minute = 0): Date => new Date(2026, 10, day, hour, minute);

function fakeStorage(): MuteStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const THROWING: MuteStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('StandupSchedule', () => {
  it('is due only from 09:00 to 09:59', () => {
    const schedule = new StandupSchedule(null);
    expect(schedule.due(at(17, 8, 59))).toBe(false);
    expect(schedule.due(at(17, 9, 0))).toBe(true);
    expect(schedule.due(at(17, 9, 59))).toBe(true);
    expect(schedule.due(at(17, 10, 0))).toBe(false);
  });

  it('is not due again the same day once done, but is the next day', () => {
    const schedule = new StandupSchedule(fakeStorage());
    schedule.markDone(at(17, 9, 5));
    expect(schedule.due(at(17, 9, 30))).toBe(false);
    expect(schedule.due(at(18, 9, 0))).toBe(true);
  });

  it('survives a reload: a fresh schedule over the same storage still knows', () => {
    const storage = fakeStorage();
    new StandupSchedule(storage).markDone(at(17, 9, 5));
    expect(storage.data.get(STANDUP_KEY)).toBe('2026-11-17');
    expect(new StandupSchedule(storage).due(at(17, 9, 40))).toBe(false);
    expect(new StandupSchedule(storage).due(at(18, 9, 0))).toBe(true);
  });

  it('holds for the page load with storage that is missing or throws', () => {
    for (const storage of [null, THROWING]) {
      const schedule = new StandupSchedule(storage);
      expect(schedule.due(at(17, 9, 0))).toBe(true);
      schedule.markDone(at(17, 9, 0));
      expect(schedule.due(at(17, 9, 30))).toBe(false);
    }
  });
});

describe('localDayNumber', () => {
  it('advances by one at local midnight', () => {
    expect(localDayNumber(at(18, 0, 1)) - localDayNumber(at(17, 23, 59))).toBe(1);
    expect(localDayNumber(at(17, 0, 0))).toBe(localDayNumber(at(17, 23, 59)));
  });
});
