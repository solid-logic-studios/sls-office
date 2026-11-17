import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { OfficeDiary } from '../../src/page/audio/office-diary.ts';
import { Soundboard } from '../../src/page/audio/soundboard.ts';
import { Standup, STANDUP_ARRIVAL_ALLOWANCE_MS } from '../../src/page/audio/standup.ts';
import { StandupSchedule, localDayNumber } from '../../src/page/audio/standup-schedule.ts';
import { voiceFor } from '../../src/page/audio/voice-casting.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab, deploy, run } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { RecordingSpeechOutput } from '../support/recording-speech-output.ts';

const at = (day: number, hour: number, minute = 0): Date => new Date(2026, 10, day, hour, minute);

/** A Standup over a real Engine and Soundboard, with the local time moved by hand. */
function open(quiet = { start: 22, end: 7 }) {
  const timers: { callback: () => void; ms: number }[] = [];
  const engine = new Engine(officeTheme, { random: seededRandom(7) });
  const speech = new RecordingSpeechOutput();
  const clock = { now: at(17, 8, 0) };
  const soundboard = new Soundboard(engine, new RecordingSoundOutput(), {
    speech,
    hour: () => clock.now.getHours() + clock.now.getMinutes() / 60,
    quietHours: quiet,
  });
  const diary = new OfficeDiary(engine.bus, () => clock.now.getTime());
  const standup = new Standup(engine, soundboard, diary, new StandupSchedule(null), (callback, ms) =>
    timers.push({ callback, ms }),
  );
  const lab = new Lab();
  const standups: string[] = [];
  engine.bus.subscribe('standup', (event) => standups.push(event.founderId));
  const feed = (events: Parameters<Lab['snapshot']>[0] = []): void => {
    const snapshot = lab.snapshot(events);
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
    diary.noteSnapshot(snapshot);
    standup.check(clock.now);
  };
  const announcements = () => speech.spoken.filter((line) => line.pieces !== undefined);
  feed();
  return { engine, speech, clock, soundboard, standup, feed, standups, announcements, timers };
}

const FOUNDERS = officeTheme.founders;
const founderOn = (day: number): string => FOUNDERS[localDayNumber(at(day, 9)) % FOUNDERS.length]?.id ?? '';

describe('Standup', () => {
  it('sends the founder to the front at 09:00 and, on arrival, says the day in their Voice', () => {
    const { engine, speech, clock, feed, standups, announcements } = open();
    feed([deploy('healthy', 'scrd-server-develop')]);
    clock.now = at(17, 9, 0);
    expect(standups).toEqual([]);
    feed();
    expect(announcements()).toEqual([]);
    expect(run(engine, 60, () => standups.length > 0)).toBe(true);

    const founder = founderOn(17);
    expect(standups).toEqual([founder]);
    // Whatever was being said when the founder arrived ends, and the Announcement goes next.
    speech.finish();
    const [said] = announcements();
    expect(said?.pieces?.slice(0, 4)).toEqual(['good morning', 'in the last day', 'one', 'deploy']);
    expect(said?.text).toBe(said?.pieces?.join(' '));
    const voices = officeTheme.soundscape?.voices;
    if (voices === undefined) throw new Error('The Office has Voices');
    expect(said?.voice).toBe(voiceFor(voices, { id: founder, part: 'founder' }));
  });

  it('does not run again the same day', () => {
    const { engine, clock, feed, standups } = open();
    clock.now = at(17, 9, 0);
    feed();
    run(engine, 60, () => standups.length > 0);
    clock.now = at(17, 9, 30);
    feed();
    run(engine, 60);
    expect(standups).toHaveLength(1);
  });

  it('is skipped, and not retried that day, while muted', () => {
    const { engine, soundboard, clock, feed, standups, announcements } = open();
    soundboard.muted = true;
    clock.now = at(17, 9, 0);
    feed();
    soundboard.muted = false;
    clock.now = at(17, 9, 30);
    feed();
    run(engine, 60);
    expect(standups).toEqual([]);
    expect(announcements()).toEqual([]);
  });

  it('is skipped in quiet hours', () => {
    const { engine, clock, feed, standups, announcements } = open({ start: 8, end: 10 });
    clock.now = at(17, 9, 0);
    feed();
    clock.now = at(17, 9, 30);
    feed();
    run(engine, 60);
    expect(standups).toEqual([]);
    expect(announcements()).toEqual([]);
  });

  it('rotates to the other founder the next day', () => {
    const { engine, clock, feed, standups } = open();
    clock.now = at(17, 9, 0);
    feed();
    run(engine, 60, () => standups.length === 1);
    run(engine, 60);
    clock.now = at(18, 9, 0);
    feed();
    run(engine, 60, () => standups.length === 2);
    expect(standups).toEqual([founderOn(17), founderOn(18)]);
    expect(founderOn(17)).not.toBe(founderOn(18));
  });

  it('runs on request without the schedule, still subject to mute', () => {
    const { engine, soundboard, clock, standup, standups } = open();
    clock.now = at(17, 15, 0);
    soundboard.muted = true;
    expect(standup.run(clock.now)).toBe(false);
    soundboard.muted = false;
    expect(standup.run(clock.now)).toBe(true);
    run(engine, 60, () => standups.length > 0);
    expect(standups).toEqual([founderOn(17)]);
  });

  describe('without the founder arriving', () => {
    it('still speaks once the allowance runs out when the page is paused', () => {
      const { clock, feed, standups, announcements, timers } = open();
      clock.now = at(17, 9, 0);
      feed();
      expect(timers.map((timer) => timer.ms)).toEqual([STANDUP_ARRIVAL_ALLOWANCE_MS]);
      expect(announcements()).toEqual([]);
      timers[0]?.callback();
      expect(standups).toEqual([]);
      expect(announcements()[0]?.pieces?.[0]).toBe('good morning');
    });

    it('speaks once on arrival, and the timer then does nothing', () => {
      const { engine, speech, clock, feed, standups, announcements, timers } = open();
      clock.now = at(17, 9, 0);
      feed();
      run(engine, 60, () => standups.length > 0);
      speech.finish();
      expect(announcements()).toHaveLength(1);
      timers[0]?.callback();
      speech.finish();
      expect(announcements()).toHaveLength(1);
    });

    it('says nothing for an arrival after the allowance', () => {
      const { engine, speech, clock, feed, standups, announcements, timers } = open();
      clock.now = at(17, 9, 0);
      feed();
      timers[0]?.callback();
      speech.finish();
      expect(announcements()).toHaveLength(1);
      run(engine, 60, () => standups.length > 0);
      speech.finish();
      expect(announcements()).toHaveLength(1);
    });

    it('still speaks when the Theme is switched mid-walk', () => {
      const { engine, speech, clock, feed, standups, announcements, timers } = open();
      clock.now = at(17, 9, 0);
      feed();
      run(engine, 1);
      engine.setTheme(officeTheme);
      run(engine, 60);
      expect(standups).toEqual([]);
      timers[0]?.callback();
      speech.finish();
      expect(announcements()).toHaveLength(1);
    });
  });
});
