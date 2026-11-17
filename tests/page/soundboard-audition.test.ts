import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { auditionLabel, auditions } from '../../src/page/audio/auditions.ts';
import { DEFAULT_QUIET_HOURS } from '../../src/page/audio/quiet-hours.ts';
import { QUIET_ALARM_VOLUME, Soundboard } from '../../src/page/audio/soundboard.ts';
import { SPEECH_GAP_MS, SpeechQueue } from '../../src/page/audio/speech-queue.ts';
import { THEMES } from '../../src/themes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { RecordingSpeechOutput } from '../support/recording-speech-output.ts';

const NIGHT = 23;
const DAY = 12;

function listen(theme: Theme, startHour: number) {
  const engine = new Engine(theme, { random: seededRandom(7) });
  const output = new RecordingSoundOutput();
  const speech = new RecordingSpeechOutput();
  const clock = { ms: 0, hour: startHour };
  const timers: (() => void)[] = [];
  const soundboard = new Soundboard(engine, output, {
    now: () => clock.ms,
    later: (callback) => timers.push(callback),
    speech,
    hour: () => clock.hour,
    quietHours: DEFAULT_QUIET_HOURS,
  });
  const snapshot = new Lab().snapshot([]);
  engine.accept(snapshot);
  soundboard.endSnapshot(snapshot);
  output.clear();
  return { engine, output, speech, soundboard, clock, snapshot, timers };
}

describe.each(THEMES.map((theme) => [theme.id, theme] as const))('auditioning %s by day', (_id, theme) => {
  it.each(auditions(theme).map((each) => [auditionLabel(each), each] as const))('plays %s', (_label, each) => {
    const { output, speech, soundboard } = listen(theme, DAY);
    soundboard.audition(each);
    const { soundscape } = theme;
    if (each.kind === 'cue') {
      expect(output.played).toEqual([
        { sound: soundscape?.[each.cue], options: { channel: 'alarm', volume: 1, pan: 0 } },
      ]);
      expect(speech.spoken).toHaveLength(0);
    } else if (each.kind === 'effect') {
      expect(output.played).toEqual([
        { sound: soundscape?.effects?.[each.effect], options: { channel: 'effect', volume: 1, pan: 0 } },
      ]);
    } else {
      expect(output.played).toHaveLength(0);
      expect(speech.spoken).toEqual([
        { text: each.text, voice: each.voice, pitch: each.voice.pitch, rate: each.voice.rate },
      ]);
    }
  });
});

describe('Soundboard.audition', () => {
  const effect = { kind: 'effect', effect: 'deployStarted' } as const;
  const alarm = { kind: 'cue', cue: 'alarm' } as const;
  const voice = auditions(officeTheme).find((each) => each.kind === 'voice');
  if (voice === undefined) throw new Error('the office has a Voice with a line');

  it('plays nothing while muted', () => {
    const { output, speech, soundboard } = listen(officeTheme, DAY);
    soundboard.muted = true;
    output.clear();
    for (const each of [alarm, effect, voice]) soundboard.audition(each);
    expect(output.played).toHaveLength(0);
    expect(speech.spoken).toHaveLength(0);
  });

  it('is not throttled like the stage effects', () => {
    const { output, soundboard } = listen(officeTheme, DAY);
    soundboard.audition(effect);
    soundboard.audition(effect);
    expect(output.played).toHaveLength(2);
  });

  it('ducks and interrupts for an Alarm', () => {
    const { output, speech, soundboard } = listen(officeTheme, DAY);
    soundboard.audition(voice);
    soundboard.audition(alarm);
    expect(speech.stops).toBeGreaterThan(0);
    expect(output.levels.some((change) => change.channel === 'effect' && change.level < 1)).toBe(true);
    soundboard.audition(voice);
    expect(speech.spoken).toHaveLength(1);
  });

  it('says a Voice again at once, past the gap, cutting off the last line', () => {
    const { speech, soundboard, clock } = listen(officeTheme, DAY);
    soundboard.audition(voice);
    clock.ms += 100;
    soundboard.audition(voice);
    expect(speech.spoken).toHaveLength(2);
    expect(speech.stops).toBe(1);
  });

  describe('in quiet hours', () => {
    it('sounds the Alarm at half volume and nothing else', () => {
      const { output, speech, soundboard } = listen(officeTheme, NIGHT);
      for (const each of auditions(officeTheme)) soundboard.audition(each);
      expect(output.played).toEqual([
        {
          sound: officeTheme.soundscape?.alarm,
          options: { channel: 'alarm', volume: QUIET_ALARM_VOLUME, pan: 0 },
        },
      ]);
      expect(speech.spoken).toHaveLength(0);
    });

    it('plays everything, the Alarm at full volume, while ignoring quiet hours', () => {
      const { output, speech, soundboard } = listen(officeTheme, NIGHT);
      soundboard.ignoreQuietHours = true;
      output.clear();
      // The Alarm holds speech back while it sounds, so it goes last.
      for (const each of [...auditions(officeTheme)].reverse()) soundboard.audition(each);
      expect(output.alarms.map((play) => play.options.volume)).toEqual([1, 1, 1]);
      expect(output.played.filter((play) => play.options.channel === 'effect').length).toBeGreaterThan(0);
      expect(speech.spoken).toHaveLength(auditions(officeTheme).filter((each) => each.kind === 'voice').length);
    });

    it('brings the bed back when ignored, and cuts it off when ignoring stops', () => {
      const { output, soundboard, engine, snapshot } = listen(officeTheme, NIGHT);
      const bedOn = (): boolean => output.ambients.at(-1)?.bed != null;
      expect(bedOn()).toBe(false);
      soundboard.ignoreQuietHours = true;
      expect(bedOn()).toBe(true);
      engine.accept(snapshot);
      soundboard.endSnapshot(snapshot);
      expect(bedOn()).toBe(true);
      output.clear();
      soundboard.ignoreQuietHours = false;
      expect(bedOn()).toBe(false);
      expect(output.stops).toContain('effect');
    });

    it('does not cut sound off on entering quiet hours while ignoring them', () => {
      const { output, soundboard, clock, engine, snapshot } = listen(officeTheme, DAY);
      soundboard.ignoreQuietHours = true;
      clock.hour = NIGHT;
      engine.accept(snapshot);
      soundboard.endSnapshot(snapshot);
      expect(output.ambients.at(-1)?.bed).not.toBeNull();
      expect(output.stops).toHaveLength(0);
    });
  });
});

describe('the master volume', () => {
  it('reaches the sound output and the speech output', () => {
    const { output, speech, soundboard } = listen(officeTheme, DAY);
    soundboard.volume = 0.4;
    expect(output.master).toBe(0.4);
    expect(speech.volume).toBe(0.4);
    expect(soundboard.volume).toBe(0.4);
  });

  it('is clamped to 0 to 1, and ignores NaN', () => {
    const { output, soundboard } = listen(officeTheme, DAY);
    soundboard.volume = 3;
    expect(soundboard.volume).toBe(1);
    soundboard.volume = -2;
    expect(soundboard.volume).toBe(0);
    soundboard.volume = Number.NaN;
    expect(soundboard.volume).toBe(0);
    expect(output.master).toBe(0);
  });

  it('is left alone until set', () => {
    const { output, speech } = listen(officeTheme, DAY);
    expect(output.master).toBeUndefined();
    expect(speech.volume).toBeUndefined();
  });
});

describe('SpeechQueue.sayNow', () => {
  const line = (text: string) => ({
    text,
    voice: { id: 'v', pitch: 1, rate: 1, lang: 'en-AU' },
    pitch: 1,
    rate: 1,
  });

  function queue() {
    const output = new RecordingSpeechOutput();
    const clock = { ms: 0 };
    const speaking: boolean[] = [];
    const speech = new SpeechQueue(output, {
      now: () => clock.ms,
      later: () => undefined,
      onSpeaking: (on) => speaking.push(on),
    });
    return { output, clock, speech, speaking };
  }

  it('starts at once, inside the gap', () => {
    const { output, speech, clock } = queue();
    speech.enqueue(line('one'));
    output.finish();
    clock.ms += 100;
    speech.sayNow(line('two'));
    expect(output.texts).toEqual(['one', 'two']);
  });

  it('cuts off the line being said and forgets the waiting ones', () => {
    const { output, speech, clock } = queue();
    speech.enqueue(line('one'));
    speech.enqueue(line('waiting'));
    speech.sayNow(line('now'));
    expect(output.stops).toBe(1);
    expect(output.texts).toEqual(['one', 'now']);
    output.finish();
    clock.ms += SPEECH_GAP_MS;
    speech.hold(false);
    expect(output.texts).toEqual(['one', 'now']);
  });

  it('still counts as the last start for the gap', () => {
    const { output, speech, clock } = queue();
    speech.sayNow(line('now'));
    output.finish();
    clock.ms += 100;
    speech.enqueue(line('next'));
    expect(output.texts).toEqual(['now']);
  });

  it('is dropped while held', () => {
    const { output, speech } = queue();
    speech.hold(true);
    speech.sayNow(line('now'));
    expect(output.texts).toEqual([]);
  });
});
