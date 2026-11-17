import { describe, expect, it } from 'vitest';
import { MUSIC_KEY, initialMusic, saveMusic } from '../../src/page/audio/music-preference.ts';
import type { MuteStorage } from '../../src/page/audio/mute-preference.ts';

function memoryStorage(initial: Record<string, string> = {}): MuteStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: MuteStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('the saved music preference', () => {
  it('is off when nothing is saved, or there is no storage', () => {
    expect(initialMusic(memoryStorage())).toBe(false);
    expect(initialMusic(null)).toBe(false);
  });

  it('remembers on and off', () => {
    const storage = memoryStorage();
    saveMusic(storage, true);
    expect(storage.data[MUSIC_KEY]).toBe('true');
    expect(initialMusic(storage)).toBe(true);
    saveMusic(storage, false);
    expect(initialMusic(storage)).toBe(false);
  });

  it('ignores storage that throws', () => {
    expect(initialMusic(throwing)).toBe(false);
    expect(() => saveMusic(throwing, true)).not.toThrow();
  });

  it('uses its own key', () => {
    expect(MUSIC_KEY).toBe('sls-office.music');
  });
});
