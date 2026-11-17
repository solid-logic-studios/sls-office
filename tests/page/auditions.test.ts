import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { auditionLabel, auditions } from '../../src/page/audio/auditions.ts';
import { voiceLines } from '../../src/page/audio/voice-lines.ts';
import { THEMES } from '../../src/themes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';

const bare: Theme = { ...officeTheme, soundscape: undefined };

describe.each(THEMES.map((theme) => [theme.id, theme] as const))('the auditions of %s', (_id, theme) => {
  const all = auditions(theme);

  it('lists the three cues first', () => {
    expect(all.slice(0, 3)).toEqual([
      { kind: 'cue', cue: 'alarm' },
      { kind: 'cue', cue: 'reminder' },
      { kind: 'cue', cue: 'allClear' },
    ]);
  });

  it('lists every effect in the Soundscape, and only those', () => {
    const listed = all.flatMap((each) => (each.kind === 'effect' ? [each.effect] : []));
    expect([...listed].sort()).toEqual(Object.keys(theme.soundscape?.effects ?? {}).sort());
  });

  it('lists one sample line per distinct Voice that has a line', () => {
    const voices = all.flatMap((each) => (each.kind === 'voice' ? [each] : []));
    const ids = voices.map((each) => each.voice.id);
    expect(new Set(ids).size).toBe(ids.length);
    const lines = voiceLines(theme);
    expect(ids.sort()).toEqual([...new Set(lines.map((each) => each.voice.id))].sort());
    for (const { voice, text } of voices) {
      expect(lines.some((each) => each.voice.id === voice.id && each.text === text)).toBe(true);
    }
  });

  it('gives every audition a distinct label', () => {
    const labels = all.map(auditionLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('auditions', () => {
  it('has none for a Theme without a Soundscape', () => {
    expect(auditions(bare)).toEqual([]);
  });

  it('labels cues, effects and Voices for a button', () => {
    expect(auditionLabel({ kind: 'cue', cue: 'allClear' })).toBe('All-clear');
    expect(auditionLabel({ kind: 'cue', cue: 'alarm' })).toBe('Alarm');
    expect(auditionLabel({ kind: 'effect', effect: 'deployStarted' })).toBe('Deploy started');
    expect(auditionLabel({ kind: 'effect', effect: 'paper' })).toBe('Paper');
    const guard = officeTheme.soundscape?.voices?.parts?.guard;
    if (guard === undefined) throw new Error('the office has a guard Voice');
    expect(auditionLabel({ kind: 'voice', voice: guard, text: 'hi' })).toBe(`Voice: ${guard.id}`);
  });
});
