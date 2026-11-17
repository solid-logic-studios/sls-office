import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.ts';
import type { Theme } from '../../src/contract/theme.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { DEFAULT_QUIET_HOURS } from '../../src/page/audio/quiet-hours.ts';
import { Soundboard } from '../../src/page/audio/soundboard.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';

/** A Soundboard over a real Engine, with a clock the test moves by hand. */
function listen(theme: Theme = officeTheme, hour = 12) {
  const engine = new Engine(theme, { random: seededRandom(7) });
  const output = new RecordingSoundOutput();
  const clock = { hour };
  const soundboard = new Soundboard(engine, output, {
    later: () => undefined,
    hour: () => clock.hour,
    quietHours: DEFAULT_QUIET_HOURS,
  });
  const lab = new Lab();
  const feed = (cpu?: number): void => {
    if (cpu !== undefined) for (const vm of lab.vms) vm.cpu = cpu;
    const snapshot = lab.snapshot();
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
  };
  const last = () => output.musics.at(-1);
  const playing = (): boolean => last()?.score != null;
  return { output, soundboard, clock, feed, last, playing };
}

const score = officeTheme.soundscape?.music;

describe('the Soundboard and the music', () => {
  it('has the Office score to play', () => {
    expect(score).toBeDefined();
  });

  it('is off by default: no score is ever sent', () => {
    const office = listen();
    office.feed(50);
    office.feed(80);
    expect(office.soundboard.musicOn).toBe(false);
    expect(office.output.musics.filter((call) => call.score !== null)).toEqual([]);
  });

  it('sends the score with the lab load on each Snapshot once on, so the tempo follows the load', () => {
    const office = listen();
    office.soundboard.musicOn = true;
    office.feed(0);
    expect(office.last()).toEqual({ score, load: 0 });
    office.feed(100);
    expect(office.last()).toEqual({ score, load: 1 });
    office.feed(50);
    expect(office.last()?.load).toBeCloseTo(0.5);
  });

  it('sends nothing before the first Snapshot and starts with it', () => {
    const office = listen();
    office.soundboard.musicOn = true;
    expect(office.output.musics).toEqual([]);
    office.feed(20);
    expect(office.playing()).toBe(true);
  });

  it('stops when switched off, and only tells the output once', () => {
    const office = listen();
    office.soundboard.musicOn = true;
    office.feed(20);
    office.soundboard.musicOn = false;
    office.feed(20);
    office.feed(20);
    expect(office.output.musics.filter((call) => call.score === null)).toHaveLength(1);
    expect(office.playing()).toBe(false);
  });

  it('is silenced by mute and comes back on unmute', () => {
    const office = listen();
    office.soundboard.musicOn = true;
    office.feed(20);
    office.soundboard.muted = true;
    expect(office.playing()).toBe(false);
    office.feed(20);
    expect(office.playing()).toBe(false);
    office.soundboard.muted = false;
    expect(office.playing()).toBe(true);
  });

  it('stays off in quiet hours, entering them stops it and leaving them brings it back', () => {
    const office = listen(officeTheme, 12);
    office.soundboard.musicOn = true;
    office.feed(20);
    expect(office.playing()).toBe(true);
    office.clock.hour = 23;
    office.feed(20);
    expect(office.playing()).toBe(false);
    office.clock.hour = 8;
    office.feed(20);
    expect(office.playing()).toBe(true);
  });

  it('starts silent in quiet hours', () => {
    const office = listen(officeTheme, 23);
    office.soundboard.musicOn = true;
    office.feed(20);
    expect(office.output.musics.filter((call) => call.score !== null)).toEqual([]);
  });

  it('plays through quiet hours when they are ignored', () => {
    const office = listen(officeTheme, 23);
    office.soundboard.ignoreQuietHours = true;
    office.soundboard.musicOn = true;
    office.feed(20);
    expect(office.playing()).toBe(true);
    office.soundboard.ignoreQuietHours = false;
    expect(office.playing()).toBe(false);
  });

  it('plays the Theme score, so a Theme without one plays nothing', () => {
    const silent: Theme = {
      ...officeTheme,
      soundscape: officeTheme.soundscape && { ...officeTheme.soundscape, music: undefined },
    };
    const office = listen(silent);
    office.soundboard.musicOn = true;
    office.feed(20);
    expect(office.output.musics).toEqual([]);
    const boxes = listen(boxesTheme);
    boxes.soundboard.musicOn = true;
    boxes.feed(20);
    expect(boxes.last()?.score).toBe(boxesTheme.soundscape?.music);
  });

  it('switches off on dispose', () => {
    const office = listen();
    office.soundboard.musicOn = true;
    office.feed(20);
    office.soundboard.dispose();
    expect(office.playing()).toBe(false);
  });
});
