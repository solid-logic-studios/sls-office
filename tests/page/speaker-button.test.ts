import { describe, expect, it } from 'vitest';
import { speakerClick, speakerFace, type SpeakerControls } from '../../src/page/speaker-button.ts';

describe('speakerFace', () => {
  it('shows sound on', () => {
    expect(speakerFace({ muted: false, blocked: false })).toEqual({
      text: 'Sound on',
      label: 'Sound on, tap to mute',
    });
  });

  it('shows muted', () => {
    expect(speakerFace({ muted: true, blocked: false })).toEqual({ text: 'Muted', label: 'Muted, tap to unmute' });
  });

  it('asks for a tap while blocked and not muted', () => {
    expect(speakerFace({ muted: false, blocked: true })).toEqual({
      text: 'Tap to enable',
      label: 'Tap to enable sound',
    });
  });

  it('shows muted when muted and blocked', () => {
    expect(speakerFace({ muted: true, blocked: true }).text).toBe('Muted');
  });

  it('starts every label with the visible text', () => {
    for (const muted of [false, true]) {
      for (const blocked of [false, true]) {
        const face = speakerFace({ muted, blocked });
        expect(face.label.startsWith(face.text)).toBe(true);
      }
    }
  });
});

/** Controls that record what a tap did. */
function controls(muted: boolean, blocked: boolean) {
  const did = { unlocked: 0, saved: [] as boolean[] };
  const fake: SpeakerControls = {
    muted,
    blocked,
    unlock: () => {
      did.unlocked += 1;
    },
    onChange: () => {},
    onToggle: (value) => {
      did.saved.push(value);
    },
  };
  return { fake, did };
}

describe('speakerClick', () => {
  it('only unlocks when blocked and not muted', () => {
    const { fake, did } = controls(false, true);
    speakerClick(fake);
    expect(fake.muted).toBe(false);
    expect(did).toEqual({ unlocked: 1, saved: [] });
  });

  it('mutes and saves when sound is on', () => {
    const { fake, did } = controls(false, false);
    speakerClick(fake);
    expect(fake.muted).toBe(true);
    expect(did).toEqual({ unlocked: 0, saved: [true] });
  });

  it('unmutes and saves when muted, even while blocked', () => {
    const { fake, did } = controls(true, true);
    speakerClick(fake);
    expect(fake.muted).toBe(false);
    expect(did).toEqual({ unlocked: 0, saved: [false] });
  });
});
