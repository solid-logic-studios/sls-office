import { describe, expect, it } from 'vitest';
import { musicClick, musicFace, type MusicControls } from '../../src/page/music-button.ts';

describe('musicFace', () => {
  it('shows music off and music on', () => {
    expect(musicFace(false)).toEqual({ text: 'Music off', label: 'Music off, tap to turn on' });
    expect(musicFace(true)).toEqual({ text: 'Music on', label: 'Music on, tap to turn off' });
  });

  it('starts every label with the visible text', () => {
    for (const on of [false, true]) expect(musicFace(on).label.startsWith(musicFace(on).text)).toBe(true);
  });
});

function controls(on: boolean, blocked: boolean) {
  const did = { unlocked: 0, saved: [] as boolean[] };
  const fake: MusicControls = {
    on,
    blocked,
    unlock: () => {
      did.unlocked += 1;
    },
    onToggle: (value) => did.saved.push(value),
  };
  return { fake, did };
}

describe('musicClick', () => {
  it('toggles the music and saves the choice', () => {
    const { fake, did } = controls(false, false);
    musicClick(fake);
    expect(fake.on).toBe(true);
    expect(did.saved).toEqual([true]);
    musicClick(fake);
    expect(fake.on).toBe(false);
    expect(did.saved).toEqual([true, false]);
    expect(did.unlocked).toBe(0);
  });

  it('also unlocks audio while the browser is holding it back', () => {
    const { fake, did } = controls(false, true);
    musicClick(fake);
    expect(did.unlocked).toBe(1);
    expect(fake.on).toBe(true);
  });

  it('only unlocks, leaving the music on, when it was saved on and the browser is holding audio back', () => {
    const { fake, did } = controls(true, true);
    musicClick(fake);
    expect(did.unlocked).toBe(1);
    expect(fake.on).toBe(true);
    expect(did.saved).toEqual([]);
  });
});
