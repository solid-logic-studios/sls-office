import { describe, expect, it } from 'vitest';
import { speakerFace } from '../../src/page/speaker-button.ts';

describe('speakerFace', () => {
  it('shows sound on', () => {
    expect(speakerFace({ muted: false, blocked: false })).toEqual({
      text: 'Sound on',
      label: 'Mute the Office',
      pressed: false,
    });
  });

  it('shows muted', () => {
    expect(speakerFace({ muted: true, blocked: false })).toEqual({
      text: 'Muted',
      label: 'Unmute the Office',
      pressed: true,
    });
  });

  it('asks for a tap while blocked and not muted', () => {
    expect(speakerFace({ muted: false, blocked: true })).toEqual({
      text: 'Tap to enable',
      label: 'Enable sound',
      pressed: false,
    });
  });

  it('shows muted when muted and blocked', () => {
    expect(speakerFace({ muted: true, blocked: true }).text).toBe('Muted');
  });
});
