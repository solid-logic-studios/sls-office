import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { clipKey } from '../../src/page/audio/clip-key.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { renderLines } from '../../scripts/voice-lines.ts';

describe('the voice-lines script', () => {
  const themes: readonly Theme[] = [officeTheme, boxesTheme];

  it('is the same list for the same input, sorted and unique by key', () => {
    const first = renderLines(themes);
    expect(JSON.stringify(renderLines(themes))).toBe(JSON.stringify(first));
    expect(first.map((line) => line.key)).toEqual([...new Set(first.map((line) => line.key))].sort());
  });

  it('lists only Voices with a Piper voice, with the Voice rate and speaker', () => {
    const soundscape = officeTheme.soundscape;
    const voices = soundscape?.voices;
    const podVoice = voices?.parts?.pod;
    if (soundscape === undefined || voices === undefined || podVoice === undefined) throw new Error('no pod voice');
    const withoutPiper: Theme = {
      ...officeTheme,
      soundscape: {
        ...soundscape,
        voices: { ...voices, parts: { ...voices.parts, pod: { ...podVoice, piper: undefined } } },
      },
    };
    const key = clipKey(podVoice.id, 'running tests!');
    expect(renderLines([withoutPiper]).some((line) => line.key === key)).toBe(false);
    const pod = renderLines([officeTheme]).find((line) => line.key === key);
    expect(pod?.rate).toBeCloseTo(podVoice.rate, 3);
    expect(pod?.speaker).toBe(99);
    expect(pod?.model).toBe('en_GB-vctk-medium');
  });
});
