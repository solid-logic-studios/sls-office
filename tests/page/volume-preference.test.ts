import { describe, expect, it } from 'vitest';
import type { MuteStorage } from '../../src/page/audio/mute-preference.ts';
import { VOLUME_KEY, initialVolume, saveVolume } from '../../src/page/audio/volume-preference.ts';

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

describe('the saved volume', () => {
  it('is full when nothing is saved or there is no storage', () => {
    expect(initialVolume(memoryStorage())).toBe(1);
    expect(initialVolume(null)).toBe(1);
  });

  it('restores a saved level, the ends included', () => {
    expect(initialVolume(memoryStorage({ [VOLUME_KEY]: '0.4' }))).toBe(0.4);
    expect(initialVolume(memoryStorage({ [VOLUME_KEY]: '0' }))).toBe(0);
    expect(initialVolume(memoryStorage({ [VOLUME_KEY]: '1' }))).toBe(1);
  });

  it.each(['loud', 'NaN', '', ' ', '-0.1', '1.5', 'Infinity'])('reads %j as full volume', (saved) => {
    expect(initialVolume(memoryStorage({ [VOLUME_KEY]: saved }))).toBe(1);
  });

  it('reads throwing storage as full volume', () => {
    expect(initialVolume(throwing)).toBe(1);
  });

  it('saves a level, and survives storage that throws or is missing', () => {
    const storage = memoryStorage();
    saveVolume(storage, 0.25);
    expect(storage.data[VOLUME_KEY]).toBe('0.25');
    expect(() => saveVolume(throwing, 0.5)).not.toThrow();
    expect(() => saveVolume(null, 0.5)).not.toThrow();
  });
});
