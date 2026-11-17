import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { clipKey } from '../../src/page/audio/clip-key.ts';
import { Soundboard } from '../../src/page/audio/soundboard.ts';
import { spokenText } from '../../src/page/audio/voice-casting.ts';
import { voiceLines } from '../../src/page/audio/voice-lines.ts';
import { THEMES } from '../../src/themes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { RecordingSpeechOutput } from '../support/recording-speech-output.ts';

/** Every bubble text the Theme can say: the line banks and each founder's lines. */
function sayable(theme: Theme): Set<string> {
  const { lines } = theme;
  return new Set([
    ...Object.values(lines.mood).flat(),
    ...Object.values(lines.part).flat(),
    ...Object.values(lines.breakSpot).flat(),
    ...Object.values(lines.cue).flat(),
    ...theme.founders.flatMap((founder) => [...founder.lines.idle, ...founder.lines.checkIn, ...founder.lines.alarm]),
  ]);
}

describe('spokenText', () => {
  it('applies an override for the exact bubble text, and otherwise lowers the text', () => {
    const spoken = { 'GET /': 'get slash' };
    expect(spokenText('GET /', spoken)).toBe('get slash');
    expect(spokenText('GET /HEALTH', spoken)).toBe('get /health');
    expect(spokenText('JOB DONE.', spoken)).toBe('job done.');
    expect(spokenText('JOB DONE.')).toBe('job done.');
  });

  it('ignores inherited object keys', () => {
    expect(spokenText('constructor', {})).toBe('constructor');
    expect(spokenText('TOSTRING', {})).toBe('tostring');
  });
});

describe.each(THEMES)('the $name theme spoken overrides', (theme) => {
  const spoken = theme.soundscape?.spoken ?? {};

  it('overrides only lines the Theme can say, so none is orphaned by an edited line', () => {
    const lines = sayable(theme);
    for (const text of Object.keys(spoken)) expect(lines.has(text), text).toBe(true);
  });

  it('gives lower-case words with no symbols or digits', () => {
    for (const [text, words] of Object.entries(spoken)) {
      expect(words.length, text).toBeGreaterThan(0);
      expect(words, text).toBe(words.toLowerCase());
      expect(words, text).not.toMatch(/[#/*_\d]/);
    }
  });
});

describe('the Office speaking an override', () => {
  it('has overrides to speak', () => {
    expect(Object.keys(officeTheme.soundscape?.spoken ?? {})).toHaveLength(30);
  });

  it('says the override, keyed the way the build lists it', () => {
    const engine = new Engine(officeTheme, { random: seededRandom(7) });
    const speech = new RecordingSpeechOutput();
    new Soundboard(engine, new RecordingSoundOutput(), { now: () => 0, later: () => undefined, speech });
    engine.accept(new Lab().snapshot());
    const worker = engine.characters().find((character) => character.part === 'worker');
    if (worker === undefined) throw new Error('no worker');
    engine.bus.publish({ kind: 'speech', speakerId: worker.id, text: 'LGTM', force: false });
    const line = speech.spoken[0];
    expect(line?.text).toBe('looks good to me');
    const keys = new Set(voiceLines(officeTheme).map((entry) => entry.key));
    expect(keys.has(clipKey(line?.voice.id ?? '', line?.text ?? ''))).toBe(true);
  });
});

describe('the Office casting', () => {
  const voices = officeTheme.soundscape?.voices;
  const cast = [voices?.default, ...Object.values(voices?.parts ?? {}), ...Object.values(voices?.founders ?? {})];

  it('gives every Part and founder its own speaker of a pinned model', () => {
    expect(cast).toHaveLength(12);
    const speakers = cast.map((voice) => voice?.piper?.speaker);
    for (const speaker of speakers) expect(speaker).toBeTypeOf('number');
    expect(new Set(speakers).size).toBe(cast.length);
    expect(new Set(cast.map((voice) => voice?.piper?.model))).toEqual(new Set(['en_US-libritts-high']));
  });

  it('gives every Voice a distinct id', () => {
    expect(new Set(cast.map((voice) => voice?.id)).size).toBe(cast.length);
  });
});
