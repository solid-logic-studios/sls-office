import { describe, expect, it } from 'vitest';
import type { Voice } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { clipKey } from '../../src/page/audio/clip-key.ts';
import { ClipSpeechOutput } from '../../src/page/audio/clip-speech-output.ts';
import { Soundboard } from '../../src/page/audio/soundboard.ts';
import type { SpokenLine } from '../../src/page/audio/speech-output.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab, oom } from '../support/lab.ts';
import { RecordingClipPlayer } from '../support/recording-clip-player.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { RecordingSpeechOutput } from '../support/recording-speech-output.ts';

const PIPER_VOICE: Voice = { id: 'v', pitch: 1.2, rate: 1, lang: 'en-AU', piper: { model: 'm' } };
const PLAIN_VOICE: Voice = { id: 'plain', pitch: 1, rate: 1, lang: 'en-AU' };
const spoken = (text: string, voice: Voice, pitch = voice.pitch): SpokenLine => ({ text, voice, pitch, rate: 1 });

function open(clips: Record<string, string> = { [clipKey('v', 'hello')]: 'abc.ogg' }) {
  const player = new RecordingClipPlayer();
  const fallback = new RecordingSpeechOutput();
  const output = new ClipSpeechOutput({ player, fallback, baseUrl: 'voices/' });
  output.useManifest(new Map(Object.entries(clips)));
  const ends: number[] = [];
  const speak = (line: SpokenLine): void => output.speak(line, () => ends.push(ends.length + 1));
  return { player, fallback, output, ends, speak };
}

describe('ClipSpeechOutput', () => {
  it('plays the clip when the manifest has it, at the per-character pitch nudge', () => {
    const { player, fallback, speak, ends } = open();
    speak(spoken('hello', PIPER_VOICE, 1.2 + 0.1));
    expect(player.played).toHaveLength(1);
    expect(player.played[0]?.url).toBe('voices/abc.ogg');
    expect(player.played[0]?.playbackRate).toBeCloseTo(1.1);
    expect(fallback.spoken).toHaveLength(0);
    player.finish();
    expect(ends).toEqual([1]);
  });

  it('keeps the nudge within a natural range', () => {
    const { player, speak } = open();
    speak(spoken('hello', PIPER_VOICE, 2));
    player.finish();
    speak(spoken('hello', PIPER_VOICE, 0));
    expect(player.played.map((clip) => clip.playbackRate)).toEqual([1.15, 0.85]);
  });

  it('nudges by the difference from the Voice pitch, whatever the Voice pitch is', () => {
    const { player, speak } = open({ [clipKey('v', 'hello')]: 'abc.ogg', [clipKey('low', 'hello')]: 'low.ogg' });
    const low: Voice = { ...PIPER_VOICE, id: 'low', pitch: 0.6 };
    speak(spoken('hello', PIPER_VOICE, 1.2));
    player.finish();
    speak(spoken('hello', low, 0.6 + 0.05));
    expect(player.played[0]?.playbackRate).toBeCloseTo(1);
    expect(player.played[1]?.playbackRate).toBeCloseTo(1.05);
  });

  it('says the line through the fallback when the manifest has no clip for it', () => {
    const { player, fallback, speak, ends } = open();
    speak(spoken('something else', PIPER_VOICE));
    expect(player.played).toHaveLength(0);
    expect(fallback.texts).toEqual(['something else']);
    fallback.finish();
    expect(ends).toEqual([1]);
  });

  it('says the line through the fallback while the manifest is still empty', () => {
    const { player, fallback, output, speak } = open();
    output.useManifest(new Map());
    speak(spoken('hello', PIPER_VOICE));
    expect(player.played).toHaveLength(0);
    expect(fallback.texts).toEqual(['hello']);
  });

  it('never plays a clip for a Voice with no Piper voice, even if the manifest has the key', () => {
    const { player, fallback, speak } = open({ [clipKey('plain', 'hello')]: 'x.ogg' });
    speak(spoken('hello', PLAIN_VOICE));
    expect(player.played).toHaveLength(0);
    expect(fallback.texts).toEqual(['hello']);
  });

  it('falls back when the clip cannot be played, and ends once', () => {
    const { player, fallback, speak, ends } = open();
    speak(spoken('hello', PIPER_VOICE));
    player.finish(true);
    expect(fallback.texts).toEqual(['hello']);
    expect(ends).toEqual([]);
    fallback.finish();
    expect(ends).toEqual([1]);
  });

  it('stop() cuts the clip off, and its line ends exactly once', () => {
    const { player, fallback, output, speak, ends } = open();
    speak(spoken('hello', PIPER_VOICE));
    output.stop();
    expect(player.stops).toBe(1);
    expect(ends).toEqual([1]);
    output.stop();
    player.finish();
    expect(ends).toEqual([1]);
    expect(fallback.stops).toBe(0);
  });

  it('stop() cuts off a fallback line, not the player', () => {
    const { player, fallback, output, speak, ends } = open();
    speak(spoken('nothing for this', PIPER_VOICE));
    output.stop();
    expect(fallback.stops).toBe(1);
    expect(player.stops).toBe(0);
    expect(ends).toEqual([1]);
  });
});

describe('a Soundboard speaking through a ClipSpeechOutput', () => {
  function listen() {
    const engine = new Engine(officeTheme, { random: seededRandom(7) });
    const output = new RecordingSoundOutput();
    const player = new RecordingClipPlayer();
    const fallback = new RecordingSpeechOutput();
    const speech = new ClipSpeechOutput({ player, fallback, baseUrl: 'voices/' });
    const clock = { ms: 0 };
    const timers: { callback: () => void; ms: number }[] = [];
    const soundboard = new Soundboard(engine, output, {
      now: () => clock.ms,
      later: (callback, ms) => timers.push({ callback, ms }),
      speech,
    });
    const lab = new Lab();
    engine.accept(lab.snapshot());
    soundboard.endSnapshot(lab.snapshot());
    const worker = engine.characters().find((character) => character.part === 'worker');
    const voice = officeTheme.soundscape?.voices?.parts?.worker;
    if (worker === undefined || voice === undefined) throw new Error('no worker');
    speech.useManifest(new Map([[clipKey(voice.id, 'hello'), 'hello.ogg']]));
    return { engine, soundboard, player, fallback, lab, output, speakerId: worker.id };
  }

  it('plays a worker line from its clip', () => {
    const { engine, player, speakerId } = listen();
    engine.bus.publish({ kind: 'speech', speakerId, text: 'HELLO', force: false });
    expect(player.played.map((clip) => clip.url)).toEqual(['voices/hello.ogg']);
  });

  it('cuts the clip off for an Alarm', () => {
    const { engine, soundboard, player, lab, output, speakerId } = listen();
    engine.bus.publish({ kind: 'speech', speakerId, text: 'HELLO', force: false });
    expect(player.playing).toBe(true);
    const snapshot = lab.snapshot([oom('scrd-server-develop')]);
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
    expect(output.alarms).toHaveLength(1);
    expect(player.stops).toBe(1);
    expect(player.playing).toBe(false);
  });

  it('cuts the clip off when muted', () => {
    const { engine, soundboard, player, speakerId } = listen();
    engine.bus.publish({ kind: 'speech', speakerId, text: 'HELLO', force: false });
    soundboard.muted = true;
    expect(player.stops).toBe(1);
    expect(player.playing).toBe(false);
  });
});
