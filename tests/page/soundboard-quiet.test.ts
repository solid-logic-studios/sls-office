import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { DEFAULT_QUIET_HOURS } from '../../src/page/audio/quiet-hours.ts';
import { QUIET_ALARM_VOLUME, REMINDER_MS, Soundboard } from '../../src/page/audio/soundboard.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab, SITE_IDS, oom } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { RecordingSpeechOutput } from '../support/recording-speech-output.ts';

const NIGHT = 23;
const DAY = 12;

/** A Soundboard over a real Engine with the office cast on stage, and a clock the test moves by hand. */
function listen(startHour: number) {
  const engine = new Engine(officeTheme, { random: seededRandom(7) });
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
  const lab = new Lab();
  const feed = (events: Parameters<Lab['snapshot']>[0] = []): void => {
    const snapshot = lab.snapshot(events);
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
  };
  feed();
  output.clear();
  /** Lets the Alarm's duck run out, as its timer would. */
  const settle = (): void => timers.splice(0).forEach((callback) => callback());
  const say = (text: string): void => {
    const speaker = engine.characters().find((character) => character.part === 'worker');
    engine.bus.publish({ kind: 'speech', speakerId: speaker?.id ?? '', text, force: false });
  };
  const deploy = (): void => {
    clock.ms += 10_000;
    engine.bus.publish({ kind: 'deploy', phase: 'started', subject: SITE_IDS[0] ?? '', at: '' });
  };
  const openCrit = (): void => {
    lab.findings = { ok: 9, warn: 0, crit: 1 };
  };
  return { engine, output, speech, soundboard, lab, clock, feed, say, deploy, openCrit, settle };
}

const effects = (output: RecordingSoundOutput) => output.played.filter((play) => play.options.channel === 'effect');
const bedIsOn = (output: RecordingSoundOutput): boolean => output.ambients.at(-1)?.bed != null;

describe('the Soundboard in quiet hours', () => {
  it('sounds an Alarm at half volume', () => {
    const office = listen(NIGHT);
    office.feed([oom('lab-test-api-develop')]);
    expect(office.output.alarms).toHaveLength(1);
    expect(office.output.alarms[0]?.sound).toBe(officeTheme.soundscape?.alarm);
    expect(office.output.alarms[0]?.options).toEqual({ channel: 'alarm', volume: QUIET_ALARM_VOLUME, pan: 0 });
  });

  it('sounds an Alarm at full volume by day', () => {
    const office = listen(DAY);
    office.feed([oom('lab-test-api-develop')]);
    expect(office.output.alarms[0]?.options.volume).toBe(1);
  });

  it('sounds no Reminder', () => {
    const office = listen(NIGHT);
    office.openCrit();
    office.feed();
    office.output.clear();
    office.clock.ms += REMINDER_MS;
    office.feed();
    expect(office.output.alarms).toHaveLength(0);
  });

  it('sounds no All-clear', () => {
    const office = listen(NIGHT);
    office.openCrit();
    office.feed();
    office.output.clear();
    office.lab.findings = { ok: 10, warn: 0, crit: 0 };
    office.feed();
    expect(office.output.alarms).toHaveLength(0);
  });

  it('plays no stage effects', () => {
    const office = listen(NIGHT);
    office.deploy();
    expect(effects(office.output)).toHaveLength(0);
  });

  it('drops speech', () => {
    const office = listen(NIGHT);
    office.say('HELLO');
    expect(office.speech.spoken).toHaveLength(0);
  });

  it('keeps the ambient bed off, and off again after an unmute', () => {
    const office = listen(NIGHT);
    expect(bedIsOn(office.output)).toBe(false);
    office.soundboard.muted = true;
    office.soundboard.muted = false;
    office.feed();
    expect(bedIsOn(office.output)).toBe(false);
  });

  it('is silent while muted, even for an Alarm', () => {
    const office = listen(NIGHT);
    office.soundboard.muted = true;
    office.feed([oom('lab-test-api-develop')]);
    expect(office.output.alarms).toHaveLength(0);
  });

  it('is off when the window is empty', () => {
    const engine = new Engine(officeTheme, { random: seededRandom(7) });
    const output = new RecordingSoundOutput();
    const soundboard = new Soundboard(engine, output, { hour: () => NIGHT, quietHours: { start: 0, end: 0 } });
    const lab = new Lab();
    engine.accept(lab.snapshot());
    soundboard.endSnapshot(lab.snapshot());
    expect(output.ambients.at(-1)?.bed).toBe(officeTheme.soundscape?.ambient);
  });
});

describe('the Soundboard going into and out of quiet hours', () => {
  it('cuts off a line being spoken and stops the effects and the bed when quiet hours begin', () => {
    const office = listen(21);
    office.feed();
    expect(bedIsOn(office.output)).toBe(true);
    office.say('HELLO');
    expect(office.speech.current).toBeDefined();
    office.output.clear();
    office.clock.hour = 22;
    office.feed();
    expect(office.speech.current).toBeUndefined();
    expect(office.speech.stops).toBeGreaterThan(0);
    expect(office.output.stops).toContain('effect');
    expect(bedIsOn(office.output)).toBe(false);
  });

  it('switches the bed off when quiet hours begin with no fresh Snapshot, as the page asks on a stale poll', () => {
    const office = listen(DAY);
    office.feed();
    expect(bedIsOn(office.output)).toBe(true);
    office.clock.hour = NIGHT;
    office.soundboard.followClock();
    expect(bedIsOn(office.output)).toBe(false);
  });

  it('brings everything back when quiet hours end', () => {
    const office = listen(NIGHT);
    office.openCrit();
    office.feed();
    office.settle();
    office.clock.hour = 7;
    office.output.clear();
    office.feed();
    expect(bedIsOn(office.output)).toBe(true);

    office.say('HELLO');
    expect(office.speech.texts).toEqual(['hello']);

    office.deploy();
    expect(effects(office.output).length).toBeGreaterThan(0);

    office.clock.ms += REMINDER_MS;
    office.feed();
    expect(office.output.alarms.map((play) => play.sound)).toEqual([officeTheme.soundscape?.reminder]);
    expect(office.output.alarms[0]?.options.volume).toBe(1);
  });

  it('brings the bed back on unmute once quiet hours have ended', () => {
    const office = listen(NIGHT);
    office.soundboard.muted = true;
    office.clock.hour = 8;
    office.feed();
    expect(bedIsOn(office.output)).toBe(false);
    office.soundboard.muted = false;
    expect(bedIsOn(office.output)).toBe(true);
  });
});
