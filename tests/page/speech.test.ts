import { describe, expect, it } from 'vitest';
import type { Part, Theme, Voice, Voices } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { ALARM_DUCK, SPEECH_DUCK, Soundboard } from '../../src/page/audio/soundboard.ts';
import { soundSeconds } from '../../src/page/audio/sound-output.ts';
import { SPEECH_GAP_MS, SPEECH_QUEUE_MAX, SPEECH_STALE_MS, SpeechQueue } from '../../src/page/audio/speech-queue.ts';
import type { SpokenLine } from '../../src/page/audio/speech-output.ts';
import { PITCH_SPREAD, RATE_SPREAD, spokenLine, voiceFor } from '../../src/page/audio/voice-casting.ts';
import { pickVoice, watchdogMs } from '../../src/page/audio/web-speech-output.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { FOUNDERS } from '../../src/themes/office/founders.ts';
import { SOUNDSCAPE } from '../../src/themes/office/soundscape.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab, oom } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { RecordingSpeechOutput } from '../support/recording-speech-output.ts';

const PARTS: readonly Part[] = [
  'worker',
  'pod',
  'greeter',
  'guard',
  'checker',
  'keeper',
  'courier',
  'wrangler',
  'founder',
];

const voice = (id: string, pitch = 1, rate = 1): Voice => ({ id, pitch, rate, lang: 'en-AU' });
const line = (text: string): SpokenLine => ({ text, voice: voice('v'), pitch: 1, rate: 1 });

describe('the Voices themes give', () => {
  const voices = officeTheme.soundscape?.voices;

  it('gives the office a Voice for every Part and each founder', () => {
    for (const part of PARTS) expect(voices?.parts?.[part], part).toBeDefined();
    for (const founder of FOUNDERS) expect(voices?.founders?.[founder.id], founder.id).toBeDefined();
  });

  it('keeps every office Voice in range, with a unique id', () => {
    const all = [voices?.default, ...Object.values(voices?.parts ?? {}), ...Object.values(voices?.founders ?? {})];
    for (const each of all) {
      expect(each?.pitch).toBeGreaterThan(0);
      expect(each?.pitch).toBeLessThanOrEqual(2);
      expect(each?.rate).toBeGreaterThanOrEqual(0.5);
      expect(each?.rate).toBeLessThanOrEqual(2);
    }
    expect(new Set(all.map((each) => each?.id)).size).toBe(all.length);
  });

  it('gives boxes a default Voice', () => {
    expect(boxesTheme.soundscape?.voices?.default).toBeDefined();
  });
});

describe('voiceFor', () => {
  const voices: Voices = {
    default: voice('default'),
    parts: { guard: voice('guard') },
    founders: { paul: voice('paul') },
  };

  it('prefers the founder, then the Part, then the default', () => {
    expect(voiceFor(voices, { id: 'paul', part: 'founder' }).id).toBe('paul');
    expect(voiceFor(voices, { id: 'g#1', part: 'guard' }).id).toBe('guard');
    expect(voiceFor(voices, { id: 'w#1', part: 'worker' }).id).toBe('default');
    expect(voiceFor(voices, { id: 'dhruv', part: 'founder' }).id).toBe('default');
  });

  it('uses the default for a speaker nobody lists, and ignores inherited object keys', () => {
    expect(voiceFor(voices, undefined).id).toBe('default');
    expect(voiceFor(voices, { id: 'constructor', part: 'worker' }).id).toBe('default');
  });
});

describe('spokenLine', () => {
  const base = voice('worker', 1, 1);

  it('is stable for one id and differs between ids sharing a Part', () => {
    const ids = ['scrd-server-develop#1', 'scrd-client-develop#1', 'bsra-bsra-staging#1', 'bsra-bsra-production#2'];
    const first = ids.map((id) => spokenLine('hi', base, id));
    expect(ids.map((id) => spokenLine('hi', base, id))).toEqual(first);
    expect(new Set(first.map((each) => each.pitch)).size).toBe(ids.length);
    expect(new Set(first.map((each) => each.rate)).size).toBe(ids.length);
  });

  it('keeps the generation suffix in the hash', () => {
    expect(spokenLine('hi', base, 'a#1').pitch).not.toBe(spokenLine('hi', base, 'a#2').pitch);
  });

  it('stays within the spread and the allowed range', () => {
    for (let n = 0; n < 200; n++) {
      const spoken = spokenLine('hi', base, `speaker-${n}`);
      expect(Math.abs(spoken.pitch - 1)).toBeLessThanOrEqual(PITCH_SPREAD + 1e-9);
      expect(Math.abs(spoken.rate - 1)).toBeLessThanOrEqual(RATE_SPREAD + 1e-9);
    }
    for (let n = 0; n < 50; n++) {
      const high = spokenLine('hi', voice('x', 2, 2), `s${n}`);
      expect(high.pitch).toBeLessThanOrEqual(2);
      expect(high.rate).toBeLessThanOrEqual(2);
      const low = spokenLine('hi', voice('x', 0, 0.5), `s${n}`);
      expect(low.pitch).toBeGreaterThanOrEqual(0);
      expect(low.rate).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('carries the text and the Voice through', () => {
    const spoken = spokenLine('hello', base, 'a');
    expect(spoken.text).toBe('hello');
    expect(spoken.voice).toBe(base);
  });
});

describe('spokenLine text', () => {
  it('lowers the bubble capitals so no engine spells the words out', () => {
    const voice = { id: 'v', pitch: 1, rate: 1, lang: 'en-AU' };
    expect(spokenLine('JOB DONE. POD GONE.', voice, 'pod-1').text).toBe('job done. pod gone.');
  });
});

describe('watchdogMs', () => {
  it('allows a slow line longer than a quick one, and never less than its slack', () => {
    expect(watchdogMs('Deploying now.', 0.8)).toBeGreaterThan(watchdogMs('Deploying now.', 1.4));
    expect(watchdogMs('', 1)).toBe(5000);
  });
});

describe('pickVoice', () => {
  const browser = [{ lang: 'en-US' }, { lang: 'en_AU' }, { lang: 'fr-FR' }];

  it('prefers an exact language, then the same primary language, else nothing', () => {
    expect(pickVoice(browser, 'en-AU')).toBe(browser[1]);
    expect(pickVoice(browser, 'en-GB')).toBe(browser[0]);
    expect(pickVoice(browser, 'de-DE')).toBeUndefined();
    expect(pickVoice([], 'en-AU')).toBeUndefined();
  });
});

describe('SpeechQueue', () => {
  function queue() {
    const output = new RecordingSpeechOutput();
    const clock = { ms: 0 };
    const timers: { callback: () => void; ms: number }[] = [];
    const speaking: boolean[] = [];
    const speech = new SpeechQueue(output, {
      now: () => clock.ms,
      later: (callback, ms) => timers.push({ callback, ms }),
      onSpeaking: (value) => speaking.push(value),
    });
    const advance = (ms: number): void => {
      clock.ms += ms;
    };
    /** Fires every timer set so far, as the clock reaching them would. */
    const fire = (): void => {
      for (const timer of timers.splice(0)) timer.callback();
    };
    return { output, speech, speaking, timers, advance, fire };
  }

  it('says one line at a time', () => {
    const { output, speech } = queue();
    speech.enqueue(line('one'));
    speech.enqueue(line('two'));
    expect(output.texts).toEqual(['one']);
  });

  it('waits for the 8 s gap from the start, then says the next line', () => {
    const { output, speech, advance, fire, timers } = queue();
    speech.enqueue(line('one'));
    advance(3000);
    speech.enqueue(line('two'));
    advance(500);
    output.finish();
    expect(output.texts).toEqual(['one']);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.ms).toBe(SPEECH_GAP_MS - 3500);
    advance(SPEECH_GAP_MS - 3500);
    fire();
    // 'two' waited 5 s, past the 4 s limit, so the gap closing finds nothing fresh to say.
    expect(output.texts).toEqual(['one']);
  });

  it('says a line that is still fresh when the gap closes', () => {
    const { output, speech, advance, fire } = queue();
    speech.enqueue(line('one'));
    advance(SPEECH_GAP_MS - 1000);
    speech.enqueue(line('two'));
    output.finish();
    advance(1000);
    fire();
    expect(output.texts).toEqual(['one', 'two']);
  });

  it('measures the gap start to start, so a long line leaves no extra wait', () => {
    const { output, speech, advance } = queue();
    speech.enqueue(line('one'));
    advance(SPEECH_GAP_MS + 1000);
    output.finish();
    speech.enqueue(line('two'));
    expect(output.texts).toEqual(['one', 'two']);
  });

  it('starts a line straight away when the gap has passed', () => {
    const { output, speech, advance } = queue();
    speech.enqueue(line('one'));
    output.finish();
    advance(SPEECH_GAP_MS);
    speech.enqueue(line('two'));
    expect(output.texts).toEqual(['one', 'two']);
  });

  it('holds at most 2 waiting lines, dropping the oldest', () => {
    expect(SPEECH_QUEUE_MAX).toBe(2);
    const { output, speech, advance, fire } = queue();
    speech.enqueue(line('now'));
    advance(SPEECH_GAP_MS - 1000);
    speech.enqueue(line('a'));
    speech.enqueue(line('b'));
    speech.enqueue(line('c'));
    output.finish();
    advance(1000);
    fire();
    // 'a' was pushed out by 'c'; of the two kept, 'b' goes first. 'c' would wait 8 s more, so it goes stale.
    expect(output.texts).toEqual(['now', 'b']);
  });

  it('drops a line older than 4 s when its turn comes', () => {
    const { output, speech, advance, fire } = queue();
    speech.enqueue(line('now'));
    speech.enqueue(line('old'));
    output.finish();
    advance(SPEECH_STALE_MS + 1);
    advance(SPEECH_GAP_MS);
    fire();
    expect(output.texts).toEqual(['now']);
  });

  it('keeps a line exactly 4 s old', () => {
    const { output, speech, advance, fire } = queue();
    speech.enqueue(line('now'));
    advance(SPEECH_GAP_MS - SPEECH_STALE_MS);
    speech.enqueue(line('fresh'));
    output.finish();
    advance(SPEECH_STALE_MS);
    fire();
    expect(output.texts).toEqual(['now', 'fresh']);
  });

  it('interrupts the current line and forgets the waiting ones', () => {
    const { output, speech, speaking, advance, fire } = queue();
    speech.enqueue(line('now'));
    speech.enqueue(line('later'));
    speech.interrupt();
    expect(output.stops).toBe(1);
    expect(speaking).toEqual([true, false]);
    advance(SPEECH_GAP_MS);
    fire();
    expect(output.texts).toEqual(['now']);
  });

  it('ignores the end of a line it already cut off', () => {
    const { speech, speaking } = queue();
    speech.enqueue(line('now'));
    speech.interrupt();
    expect(speaking).toEqual([true, false]);
  });

  it('starts nothing while held, then starts the next line on release', () => {
    const { output, speech, advance } = queue();
    speech.hold(true);
    speech.enqueue(line('a'));
    expect(output.texts).toEqual([]);
    advance(1000);
    speech.hold(false);
    expect(output.texts).toEqual(['a']);
  });

  it('reports speaking from the start to the end of each line', () => {
    const { output, speech, speaking } = queue();
    speech.enqueue(line('a'));
    output.finish();
    expect(speaking).toEqual([true, false]);
  });
});

/** A Soundboard over a real Engine with a Lab's cast on stage, a fake clock, a fake `later`, and recording outputs. */
function listen(theme: Theme) {
  const engine = new Engine(theme, { random: seededRandom(7) });
  const output = new RecordingSoundOutput();
  const speech = new RecordingSpeechOutput();
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
  output.clear();
  const say = (speakerId: string, text: string): void =>
    engine.bus.publish({ kind: 'speech', speakerId, text, force: false });
  const idOf = (part: Part): string => engine.characters().find((character) => character.part === part)?.id ?? '';
  return { engine, output, speech, soundboard, lab, timers, clock, say, idOf };
}

describe('the Soundboard speaking', () => {
  it('gives no voice to a hidden speaker, which has no bubble', () => {
    const engine = new Engine(officeTheme, { random: seededRandom(7) });
    engine.accept(new Lab().snapshot());
    const speech = new RecordingSpeechOutput();
    const hidden = engine.characters().map((character) => ({ ...character, visible: false }));
    const source = {
      bus: engine.bus,
      theme: engine.theme,
      findings: engine.findings,
      layout: engine.layout,
      characters: () => hidden,
    };
    new Soundboard(source, new RecordingSoundOutput(), { now: () => 0, later: () => undefined, speech });
    engine.bus.publish({ kind: 'speech', speakerId: hidden[0]?.id ?? '', text: 'HELLO', force: false });
    expect(speech.spoken).toHaveLength(0);
  });

  it('speaks a bubble line in its speaker Part Voice', () => {
    const { speech, say, idOf } = listen(officeTheme);
    const worker = idOf('worker');
    say(worker, 'HELLO');
    expect(speech.spoken).toHaveLength(1);
    expect(speech.spoken[0]?.text).toBe('hello');
    expect(speech.spoken[0]?.voice).toBe(officeTheme.soundscape?.voices?.parts?.worker);
  });

  it('gives two characters sharing a Part different but stable pitch and rate', () => {
    const { engine, speech, soundboard, say, clock } = listen(officeTheme);
    const workers = engine.characters().filter((character) => character.part === 'worker');
    expect(workers.length).toBeGreaterThan(1);
    const [first, second] = workers;
    say(first?.id ?? '', 'a');
    speech.finish();
    clock.ms += SPEECH_GAP_MS;
    say(second?.id ?? '', 'b');
    speech.finish();
    clock.ms += SPEECH_GAP_MS;
    say(first?.id ?? '', 'c');
    const [a, b, c] = speech.spoken;
    expect(a?.pitch).not.toBe(b?.pitch);
    expect(a?.rate).not.toBe(b?.rate);
    expect(c?.pitch).toBe(a?.pitch);
    expect(c?.rate).toBe(a?.rate);
    soundboard.dispose();
  });

  it('uses a founder own Voice, and the default for a speaker not on stage', () => {
    const { speech, say, clock } = listen(officeTheme);
    say(FOUNDERS[0]?.id ?? '', 'founder');
    expect(speech.spoken[0]?.voice).toBe(officeTheme.soundscape?.voices?.founders?.[FOUNDERS[0]?.id ?? '']);
    speech.finish();
    clock.ms += SPEECH_GAP_MS;
    say('a-passing-visitor', 'visitor');
    expect(speech.spoken[1]?.voice).toBe(officeTheme.soundscape?.voices?.default);
  });

  it('says one speaker at a time, and no more than one line per 8 s', () => {
    const { speech, say, idOf, clock, timers } = listen(officeTheme);
    const worker = idOf('worker');
    say(worker, 'one');
    say(worker, 'two');
    expect(speech.texts).toEqual(['one']);
    clock.ms += 2000;
    speech.finish();
    expect(speech.texts).toEqual(['one']);
    clock.ms += SPEECH_GAP_MS - 2000;
    say(worker, 'three');
    for (const timer of timers.splice(0)) timer.callback();
    // 'two' is 8 s old by now, so only the fresh line is voiced.
    expect(speech.texts).toEqual(['one', 'three']);
  });

  it('is silent for a theme without Voices', () => {
    const { voices: _voices, ...withoutVoices } = SOUNDSCAPE;
    const silent: Theme = { ...officeTheme, soundscape: withoutVoices };
    const { speech, say, idOf } = listen(silent);
    say(idOf('worker'), 'nothing');
    expect(speech.spoken).toEqual([]);
  });

  it('is silent while muted, and muting cuts off a line mid-sentence', () => {
    const { speech, soundboard, say, idOf, clock } = listen(officeTheme);
    const worker = idOf('worker');
    say(worker, 'long line');
    expect(speech.current).toBeDefined();
    soundboard.muted = true;
    expect(speech.stops).toBe(1);
    expect(speech.current).toBeUndefined();
    clock.ms += SPEECH_GAP_MS;
    say(worker, 'ignored');
    expect(speech.texts).toEqual(['long line']);
    soundboard.muted = false;
    say(worker, 'back again');
    expect(speech.texts).toEqual(['long line', 'back again']);
  });

  it('ducks the ambient bed while speaking, and restores it when the line ends', () => {
    const { output, speech, say, idOf } = listen(officeTheme);
    say(idOf('worker'), 'hello');
    expect(output.levels.at(-1)).toEqual({ channel: 'ambient', level: SPEECH_DUCK });
    expect(output.levels.some((change) => change.channel === 'effect' && change.level < 1)).toBe(false);
    speech.finish();
    expect(output.levels.at(-1)).toEqual({ channel: 'ambient', level: 1 });
  });

  it('keeps the lower of the Alarm and speech ducks on the bed', () => {
    const { output, soundboard, lab, speech, say, idOf, timers, engine } = listen(officeTheme);
    expect(ALARM_DUCK).toBeLessThan(SPEECH_DUCK);
    say(idOf('worker'), 'hello');
    expect(output.levels.at(-1)).toEqual({ channel: 'ambient', level: SPEECH_DUCK });
    const snapshot = lab.snapshot([oom('scrd-server-develop')]);
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
    // The Alarm cut the line off, so only the Alarm duck is left on the bed.
    expect(speech.current).toBeUndefined();
    expect(output.levels.at(-1)).toEqual({ channel: 'ambient', level: ALARM_DUCK });
    timers.at(-1)?.callback();
    expect(output.levels.at(-1)).toEqual({ channel: 'ambient', level: 1 });
  });

  it('interrupts speech for the Alarm and holds it back for the Alarm length', () => {
    const { engine, output, soundboard, lab, speech, say, idOf, timers, clock } = listen(officeTheme);
    const worker = idOf('worker');
    say(worker, 'before');
    const snapshot = lab.snapshot([oom('scrd-server-develop')]);
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
    expect(output.alarms).toHaveLength(1);
    expect(speech.stops).toBe(1);
    expect(speech.current).toBeUndefined();

    clock.ms += SPEECH_GAP_MS;
    say(worker, 'during the alarm');
    expect(speech.texts).toEqual(['before']);

    const restore = timers.at(-1);
    expect(restore?.ms).toBeCloseTo(soundSeconds(officeTheme.soundscape?.alarm ?? { notes: [] }) * 1000);
    restore?.callback();
    expect(speech.texts).toEqual(['before', 'during the alarm']);
  });
});
