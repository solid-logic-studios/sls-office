import { describe, expect, it } from 'vitest';
import { MUTE_KEY, initialMuted, saveMuted, type MuteStorage } from '../../src/page/audio/mute-preference.ts';

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

const none = new URLSearchParams();
const forced = new URLSearchParams('mute');

describe('the saved mute preference', () => {
  it('is sound on when nothing is saved', () => {
    expect(initialMuted(none, memoryStorage())).toBe(false);
  });

  it('restores a saved mute', () => {
    expect(initialMuted(none, memoryStorage({ [MUTE_KEY]: 'true' }))).toBe(true);
  });

  it('restores a saved unmute', () => {
    expect(initialMuted(none, memoryStorage({ [MUTE_KEY]: 'false' }))).toBe(false);
  });

  it('lets ?mute win over a saved unmute', () => {
    expect(initialMuted(forced, memoryStorage({ [MUTE_KEY]: 'false' }))).toBe(true);
    expect(initialMuted(new URLSearchParams('mute=0'), null)).toBe(true);
  });

  it('saves a toggle', () => {
    const storage = memoryStorage();
    saveMuted(none, storage, true);
    expect(storage.data[MUTE_KEY]).toBe('true');
  });

  it('does not save while ?mute is in the URL', () => {
    const storage = memoryStorage({ [MUTE_KEY]: 'false' });
    saveMuted(forced, storage, true);
    expect(storage.data[MUTE_KEY]).toBe('false');
  });

  it('works when storage throws', () => {
    expect(initialMuted(none, throwing)).toBe(false);
    expect(() => saveMuted(none, throwing, true)).not.toThrow();
  });

  it('works with no storage', () => {
    expect(initialMuted(none, null)).toBe(false);
    expect(() => saveMuted(none, null, true)).not.toThrow();
  });
});
