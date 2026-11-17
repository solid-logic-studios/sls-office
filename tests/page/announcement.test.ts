import { describe, expect, it } from 'vitest';
import type { Theme, Voice } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { clipKey } from '../../src/page/audio/clip-key.ts';
import { ClipSpeechOutput } from '../../src/page/audio/clip-speech-output.ts';
import { DEFAULT_QUIET_HOURS } from '../../src/page/audio/quiet-hours.ts';
import { Soundboard } from '../../src/page/audio/soundboard.ts';
import type { SpokenLine } from '../../src/page/audio/speech-output.ts';
import { SPEECH_GAP_MS, SpeechQueue } from '../../src/page/audio/speech-queue.ts';
import { announcerVoice, voiceFor } from '../../src/page/audio/voice-casting.ts';
import { voiceLines } from '../../src/page/audio/voice-lines.ts';
import { THEMES } from '../../src/themes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab } from '../support/lab.ts';
import { RecordingClipPlayer } from '../support/recording-clip-player.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { RecordingSpeechOutput } from '../support/recording-speech-output.ts';

const VOICE: Voice = { id: 'v', pitch: 1, rate: 1, lang: 'en-AU', piper: { model: 'm' } };
const announcement = (...pieces: string[]): SpokenLine => ({
  text: pieces.join(' '),
  pieces,
  voice: VOICE,
  pitch: 1,
  rate: 1,
});
const plain = (text: string): SpokenLine => ({ text, voice: VOICE, pitch: 1, rate: 1 });

describe('ClipSpeechOutput with an Announcement', () => {
  function open(known: readonly string[]) {
    const player = new RecordingClipPlayer();
    const fallback = new RecordingSpeechOutput();
    const output = new ClipSpeechOutput({ player, fallback, baseUrl: 'voices/' });
    output.useManifest(new Map(known.map((word) => [clipKey('v', word), `${word}.ogg`])));
    let ends = 0;
    const speak = (...pieces: string[]): void => output.speak(announcement(...pieces), () => (ends += 1));
    return { player, fallback, output, speak, ends: () => ends };
  }

  it('plays each piece that has a clip, in order, and ends once after the last', () => {
    const { player, fallback, speak, ends } = open(['three', 'rooms up']);
    speak('three', 'rooms up');
    expect(player.played.map((clip) => clip.url)).toEqual(['voices/three.ogg']);
    player.finish();
    expect(player.played.map((clip) => clip.url)).toEqual(['voices/three.ogg', 'voices/rooms up.ogg']);
    expect(ends()).toBe(0);
    player.finish();
    expect(ends()).toBe(1);
    expect(fallback.spoken).toHaveLength(0);
  });

  it('sends an out-of-vocabulary piece to the fallback, between clips', () => {
    const { player, fallback, speak, ends } = open(['rooms up']);
    speak('25', 'rooms up');
    expect(fallback.texts).toEqual(['25']);
    expect(fallback.spoken[0]?.pieces).toBeUndefined();
    fallback.finish();
    player.finish();
    expect(player.played).toHaveLength(1);
    expect(ends()).toBe(1);
  });

  it('joins consecutive pieces without a clip into one fallback utterance', () => {
    const { player, fallback, speak, ends } = open(['rooms up']);
    speak('25', 'twenty six', 'rooms up', 'thirty');
    expect(fallback.texts).toEqual(['25 twenty six']);
    fallback.finish();
    player.finish();
    expect(fallback.texts).toEqual(['25 twenty six', 'thirty']);
    fallback.finish();
    expect(ends()).toBe(1);
  });

  it('falls back for a piece whose clip fails, and carries on', () => {
    const { player, fallback, speak, ends } = open(['three', 'rooms up']);
    speak('three', 'rooms up');
    player.finish(true);
    expect(fallback.texts).toEqual(['three']);
    fallback.finish();
    expect(player.played).toHaveLength(2);
    player.finish();
    expect(ends()).toBe(1);
  });

  it('plays every clip at the same playback rate', () => {
    const { player, speak } = open(['three', 'rooms up']);
    speak('three', 'rooms up');
    player.finish();
    expect(new Set(player.played.map((clip) => clip.playbackRate)).size).toBe(1);
  });

  it('stop() abandons the rest and ends once', () => {
    const { player, output, speak, ends } = open(['three', 'rooms up']);
    speak('three', 'rooms up');
    output.stop();
    expect(player.stops).toBe(1);
    expect(player.played).toHaveLength(1);
    expect(ends()).toBe(1);
    player.finish();
    expect(ends()).toBe(1);
  });

  it('stop() during a fallback utterance abandons the rest too', () => {
    const { player, fallback, output, speak, ends } = open(['rooms up']);
    speak('25', 'rooms up');
    output.stop();
    expect(fallback.stops).toBe(1);
    expect(player.played).toHaveLength(0);
    expect(ends()).toBe(1);
  });

  it('falls back for every piece for a Voice with no Piper voice', () => {
    const { fallback, output } = open(['three']);
    const plainVoice: Voice = { id: 'v', pitch: 1, rate: 1, lang: 'en-AU' };
    output.speak({ ...announcement('three', 'rooms up'), voice: plainVoice }, () => undefined);
    expect(fallback.texts).toEqual(['three rooms up']);
  });
});

describe('SpeechQueue.announce', () => {
  function queue() {
    const output = new RecordingSpeechOutput();
    const clock = { ms: 0 };
    const timers: (() => void)[] = [];
    const speech = new SpeechQueue(output, {
      now: () => clock.ms,
      later: (callback) => timers.push(callback),
      onSpeaking: () => undefined,
    });
    return { output, clock, speech, timers };
  }

  it('says an Announcement at once when nothing is being said', () => {
    const { output, speech } = queue();
    speech.announce(announcement('all calm'));
    expect(output.texts).toEqual(['all calm']);
  });

  it('waits for the line being said, then goes ahead of waiting lines, ignoring the gap', () => {
    const { output, clock, speech } = queue();
    speech.enqueue(plain('one'));
    speech.enqueue(plain('two'));
    speech.announce(announcement('all calm'));
    expect(output.texts).toEqual(['one']);
    clock.ms += 100;
    output.finish();
    expect(output.texts).toEqual(['one', 'all calm']);
  });

  it('ignores the stale rule and counts as the last start', () => {
    const { output, clock, speech, timers } = queue();
    speech.enqueue(plain('one'));
    speech.announce(announcement('all calm'));
    clock.ms += 20_000;
    output.finish();
    expect(output.texts).toEqual(['one', 'all calm']);
    clock.ms += 5000;
    speech.enqueue(plain('two'));
    output.finish();
    expect(output.texts).toEqual(['one', 'all calm']);
    clock.ms += SPEECH_GAP_MS - 5000;
    timers.splice(0).forEach((callback) => callback());
    expect(output.texts).toEqual(['one', 'all calm', 'two']);
  });

  it('keeps only the newest waiting Announcement', () => {
    const { output, speech } = queue();
    speech.enqueue(plain('one'));
    speech.announce(announcement('first'));
    speech.announce(announcement('second'));
    output.finish();
    expect(output.texts).toEqual(['one', 'second']);
    output.finish();
    expect(output.texts).toEqual(['one', 'second']);
  });

  it('waits while held rather than being dropped', () => {
    const { output, speech } = queue();
    speech.hold(true);
    speech.announce(announcement('all calm'));
    expect(output.texts).toEqual([]);
    speech.hold(false);
    expect(output.texts).toEqual(['all calm']);
  });

  it('is forgotten by interrupt()', () => {
    const { output, speech } = queue();
    speech.enqueue(plain('one'));
    speech.announce(announcement('all calm'));
    speech.interrupt();
    expect(output.texts).toEqual(['one']);
  });
});

const NIGHT = 23;
const DAY = 12;

function listen(hour = DAY) {
  const engine = new Engine(officeTheme, { random: seededRandom(7) });
  const speech = new RecordingSpeechOutput();
  const clock = { ms: 0 };
  const soundboard = new Soundboard(engine, new RecordingSoundOutput(), {
    now: () => clock.ms,
    later: () => undefined,
    speech,
    hour: () => hour,
    quietHours: DEFAULT_QUIET_HOURS,
  });
  const lab = new Lab();
  const feed = (): void => {
    const snapshot = lab.snapshot();
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
  };
  return { engine, speech, soundboard, lab, clock, feed };
}

describe('Soundboard.announceStatus', () => {
  it('says nothing before the first Snapshot', () => {
    const { soundboard, speech } = listen();
    soundboard.announceStatus();
    expect(speech.spoken).toEqual([]);
  });

  it("speaks the composed pieces in the first founder's Voice", () => {
    const { soundboard, speech, feed } = listen();
    feed();
    soundboard.announceStatus();
    const first = officeTheme.founders[0];
    const voices = officeTheme.soundscape?.voices;
    if (first === undefined || voices === undefined) throw new Error('The Office has a founder and Voices');
    const said = speech.spoken[0];
    expect(said?.voice).toBe(voiceFor(voices, { id: first.id, part: 'founder' }));
    expect(said?.voice).toBe(announcerVoice(officeTheme));
    expect(said?.pieces?.slice(0, 2)).toEqual(['four', 'rooms up']);
    expect(said?.text).toBe(said?.pieces?.join(' '));
  });

  it('reports a room down and a critical finding', () => {
    const { soundboard, speech, lab, feed } = listen();
    lab.vm('ci').up = false;
    lab.findings = { ok: 5, warn: 0, crit: 2 };
    feed();
    soundboard.announceStatus();
    const pieces = speech.spoken[0]?.pieces ?? [];
    expect(pieces).toEqual(expect.arrayContaining(['three', 'rooms up', 'one', 'room down']));
    expect(pieces.slice(-2)).toEqual(['two', 'critical findings']);
  });

  it('says nothing while muted', () => {
    const { soundboard, speech, feed } = listen();
    feed();
    soundboard.muted = true;
    soundboard.announceStatus();
    expect(speech.spoken).toEqual([]);
  });

  it('says nothing in quiet hours', () => {
    const { soundboard, speech, feed } = listen(NIGHT);
    feed();
    soundboard.announceStatus();
    expect(speech.spoken).toEqual([]);
  });

  it('waits behind a line being said, but skips the gap', () => {
    const { engine, soundboard, speech, clock, feed } = listen();
    feed();
    const speaker = engine.characters().find((character) => character.part === 'worker');
    engine.bus.publish({ kind: 'speech', speakerId: speaker?.id ?? '', text: 'HELLO', force: false });
    expect(speech.texts).toEqual(['hello']);
    soundboard.announceStatus();
    expect(speech.spoken).toHaveLength(1);
    clock.ms += 50;
    speech.finish();
    expect(speech.spoken).toHaveLength(2);
    expect(speech.spoken[1]?.pieces).toBeDefined();
  });

  it('says nothing for a Theme without a vocabulary', () => {
    const engine = new Engine(officeTheme, { random: seededRandom(7) });
    const bare: Theme = { ...officeTheme, soundscape: { ...officeTheme.soundscape!, vocabulary: undefined } };
    engine.setTheme(bare);
    const speech = new RecordingSpeechOutput();
    const soundboard = new Soundboard(engine, new RecordingSoundOutput(), { speech, hour: () => DAY });
    const snapshot = new Lab().snapshot();
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
    soundboard.announceStatus();
    expect(speech.spoken).toEqual([]);
  });
});

describe.each(THEMES)('the $name theme vocabulary', (theme) => {
  const vocabulary = theme.soundscape?.vocabulary;
  const words =
    vocabulary === undefined
      ? []
      : [
          ...vocabulary.numbers,
          ...Object.values(vocabulary.parts),
          ...Object.values(vocabulary.moods),
          ...Object.values(vocabulary.phrases),
        ];

  it('is spoken as written: lower case, no digits, never empty', () => {
    for (const word of words) {
      expect(word.length, word).toBeGreaterThan(0);
      expect(word, word).toBe(word.toLowerCase());
      expect(word, word).not.toMatch(/\d/);
      expect(word, word).toBe(word.trim());
    }
  });

  it('is rendered for every announcing Voice, under the key the page looks up', () => {
    if (vocabulary === undefined) return;
    const voices = theme.soundscape?.voices;
    if (voices === undefined) throw new Error('A vocabulary needs Voices');
    const announcers =
      theme.founders.length === 0
        ? [voices.default]
        : theme.founders.map((founder) => voiceFor(voices, { id: founder.id, part: 'founder' }));
    const keys = new Set(voiceLines(theme).map((entry) => entry.key));
    for (const voice of announcers)
      for (const word of words) expect(keys.has(clipKey(voice.id, word)), word).toBe(true);
  });
});

describe('the Office vocabulary', () => {
  const vocabulary = officeTheme.soundscape?.vocabulary;

  it('has number words from zero to twenty', () => {
    expect(vocabulary?.numbers.length).toBeGreaterThanOrEqual(21);
  });

  it('names every Part but the founder', () => {
    for (const part of ['worker', 'pod', 'greeter', 'guard', 'checker', 'keeper', 'courier', 'wrangler'] as const) {
      expect(vocabulary?.parts[part], part).toBeDefined();
    }
  });

  it('looks up the same clip the page plays for an Announcement piece', () => {
    const voice = announcerVoice(officeTheme);
    if (voice === undefined) throw new Error('The Office announces');
    const manifest = new Map(
      voiceLines(officeTheme)
        .filter((entry) => entry.voice.id === voice.id && entry.text === 'rooms up')
        .map((entry) => [entry.key, 'rooms-up.ogg']),
    );
    const player = new RecordingClipPlayer();
    const output = new ClipSpeechOutput({ player, fallback: new RecordingSpeechOutput(), baseUrl: '' });
    output.useManifest(manifest);
    output.speak(
      { text: 'rooms up', pieces: ['rooms up'], voice, pitch: voice.pitch, rate: voice.rate },
      () => undefined,
    );
    expect(player.played.map((clip) => clip.url)).toEqual(['rooms-up.ogg']);
  });
});
