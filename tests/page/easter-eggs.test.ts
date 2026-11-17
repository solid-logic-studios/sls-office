import { describe, expect, it } from 'vitest';
import type { EffectName } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { DEFAULT_QUIET_HOURS } from '../../src/page/audio/quiet-hours.ts';
import {
  CALM_SINCE_KEY,
  SNORE_EVERY_MS,
  STREAK_CELEBRATED_KEY,
  UPTIME_MILESTONES_DAYS,
} from '../../src/page/audio/easter-eggs.ts';
import type { MuteStorage } from '../../src/page/audio/mute-preference.ts';
import { Soundboard } from '../../src/page/audio/soundboard.ts';
import { EFFECT_THROTTLE_MS } from '../../src/page/audio/stage-effects.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab, SITE_IDS, oom, run } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const FAINTED = 'lab-test-api-develop';
const SITE = SITE_IDS[0] ?? '';

/** An in-memory `Storage`, shared between "page loads" in the tests that reload. */
class MemoryStorage implements MuteStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const THROWING: MuteStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

interface Clocks {
  ms: number;
  hour: number;
  wall: number;
}

/** A Soundboard over a real Engine, with every clock moved by hand. */
function listen(options: { hour?: number; storage?: MuteStorage | null; clocks?: Clocks } = {}) {
  const engine = new Engine(officeTheme, { random: seededRandom(7) });
  const output = new RecordingSoundOutput();
  const clocks = options.clocks ?? { ms: 0, hour: options.hour ?? 12, wall: 1_000_000_000_000 };
  const timers: { callback: () => void; ms: number }[] = [];
  const soundboard = new Soundboard(engine, output, {
    now: () => clocks.ms,
    later: (callback, ms) => timers.push({ callback, ms }),
    hour: () => clocks.hour,
    quietHours: DEFAULT_QUIET_HOURS,
    wallNow: () => clocks.wall,
    storage: options.storage ?? null,
  });
  const lab = new Lab();
  const feed = (events: Parameters<Lab['snapshot']>[0] = []): void => {
    const snapshot = lab.snapshot(events);
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
  };
  feed();
  output.clear();
  /** Fires every timer waiting, as the clock reaching them would. */
  const fire = (): void => timers.splice(0).forEach((timer) => timer.callback());
  /** The snore loop's pending timers (an Alarm's duck restore waits on `later` too). */
  const snoreTimers = () => timers.filter((timer) => timer.ms === SNORE_EVERY_MS);
  const heard = (name: EffectName) =>
    output.played.filter((play) => play.sound === officeTheme.soundscape?.effects?.[name]);
  return { engine, output, soundboard, clocks, snoreTimers, feed, fire, heard };
}

describe('the snore', () => {
  it('starts when a character faints, at that character, and repeats on the timer', () => {
    const office = listen();
    office.feed([oom(FAINTED)]);
    expect(office.heard('snore')).toHaveLength(1);
    expect(office.heard('snore')[0]?.options.channel).toBe('effect');
    office.clocks.ms += SNORE_EVERY_MS;
    office.fire();
    expect(office.heard('snore')).toHaveLength(2);
  });

  it('stops once the character has recovered', () => {
    const office = listen();
    office.feed([oom(FAINTED)]);
    run(office.engine, 10);
    office.clocks.ms += SNORE_EVERY_MS;
    office.fire();
    expect(office.heard('snore')).toHaveLength(1);
    expect(office.snoreTimers()).toHaveLength(0);
  });

  it('keeps a single loop across Snapshots', () => {
    const office = listen();
    office.feed([oom(FAINTED)]);
    office.feed();
    office.feed();
    expect(office.snoreTimers()).toHaveLength(1);
    expect(office.heard('snore')).toHaveLength(1);
  });

  it('is silent while muted', () => {
    const office = listen();
    office.soundboard.muted = true;
    office.feed([oom(FAINTED)]);
    expect(office.output.played).toEqual([]);
  });

  it('is silent in quiet hours', () => {
    const office = listen({ hour: 23 });
    office.feed([oom(FAINTED)]);
    expect(office.heard('snore')).toEqual([]);
  });
});

describe('the uptime streak', () => {
  const week = 7 * DAY_MS;

  it('fires at 7 days, and not again until 30', () => {
    const office = listen();
    office.feed();
    office.clocks.wall += week - 1;
    office.feed();
    expect(office.heard('streak')).toEqual([]);
    office.clocks.wall += 1;
    office.feed();
    expect(office.heard('streak')).toHaveLength(1);
    office.clocks.ms += EFFECT_THROTTLE_MS;
    office.clocks.wall += 20 * DAY_MS;
    office.feed();
    expect(office.heard('streak')).toHaveLength(1);
    office.clocks.wall += 3 * DAY_MS;
    office.feed();
    expect(office.heard('streak')).toHaveLength(2);
  });

  it('starts over after an Alarm', () => {
    const office = listen();
    office.feed();
    office.clocks.wall += 6 * DAY_MS;
    office.feed([oom(FAINTED)]);
    office.clocks.ms += EFFECT_THROTTLE_MS;
    office.clocks.wall += 2 * DAY_MS;
    office.feed();
    expect(office.heard('streak')).toEqual([]);
    office.clocks.wall += 5 * DAY_MS;
    office.feed();
    expect(office.heard('streak')).toHaveLength(1);
  });

  it('is not lost, nor repeated, by a reload', () => {
    const storage = new MemoryStorage();
    const clocks: Clocks = { ms: 0, hour: 12, wall: 1_000_000_000_000 };
    const first = listen({ storage, clocks });
    first.feed();
    clocks.wall += week;
    first.feed();
    expect(first.heard('streak')).toHaveLength(1);
    expect(storage.getItem(STREAK_CELEBRATED_KEY)).toBe('7');
    first.soundboard.dispose();
    const second = listen({ storage, clocks });
    second.feed();
    expect(second.heard('streak')).toEqual([]);
    clocks.wall += 23 * DAY_MS;
    clocks.ms += EFFECT_THROTTLE_MS;
    second.feed();
    expect(second.heard('streak')).toHaveLength(1);
    expect(storage.getItem(CALM_SINCE_KEY)).toBe('1000000000000');
  });

  it('keeps going when storage throws', () => {
    const office = listen({ storage: THROWING });
    office.feed();
    office.clocks.wall += week;
    office.feed();
    expect(office.heard('streak')).toHaveLength(1);
    office.feed();
    expect(office.heard('streak')).toHaveLength(1);
  });

  it('counts a milestone celebrated while muted, without sound', () => {
    const office = listen();
    office.feed();
    office.soundboard.muted = true;
    office.clocks.wall += week;
    office.feed();
    office.soundboard.muted = false;
    office.clocks.ms += EFFECT_THROTTLE_MS;
    office.feed();
    expect(office.output.played).toEqual([]);
  });

  it('has milestones in ascending order', () => {
    expect([...UPTIME_MILESTONES_DAYS].sort((a, b) => a - b)).toEqual(UPTIME_MILESTONES_DAYS);
  });
});

describe('smoko', () => {
  it('sounds once as the clock crosses 10:30', () => {
    const office = listen({ hour: 10.4 });
    office.feed();
    expect(office.heard('smoko')).toEqual([]);
    office.clocks.hour = 10.6;
    office.feed();
    expect(office.heard('smoko')).toHaveLength(1);
    office.clocks.ms += EFFECT_THROTTLE_MS;
    office.clocks.hour = 10.7;
    office.feed();
    expect(office.heard('smoko')).toHaveLength(1);
  });

  it('does not sound for a page that starts after 10:30', () => {
    const office = listen({ hour: 10.9 });
    office.feed();
    office.clocks.hour = 11;
    office.feed();
    expect(office.heard('smoko')).toEqual([]);
  });
});

describe('the hat-trick', () => {
  /** Publishes one deploy outcome on the bus, a throttle apart from the last. */
  const finish = (office: ReturnType<typeof listen>, phase: 'healthy' | 'rolled-back'): void => {
    office.clocks.ms += EFFECT_THROTTLE_MS;
    office.engine.bus.publish({ kind: 'deploy', phase, subject: SITE, at: '' });
  };

  it('sounds on the third healthy deploy in a row', () => {
    const office = listen();
    finish(office, 'healthy');
    finish(office, 'healthy');
    expect(office.heard('hatTrick')).toEqual([]);
    finish(office, 'healthy');
    expect(office.heard('hatTrick')).toHaveLength(1);
    finish(office, 'healthy');
    expect(office.heard('hatTrick')).toHaveLength(1);
  });

  it('is reset by a rollback', () => {
    const office = listen();
    finish(office, 'healthy');
    finish(office, 'healthy');
    finish(office, 'rolled-back');
    finish(office, 'healthy');
    expect(office.heard('hatTrick')).toEqual([]);
  });

  it('is throttled like any effect', () => {
    const office = listen();
    for (let i = 0; i < 3; i += 1) finish(office, 'healthy');
    office.clocks.ms -= EFFECT_THROTTLE_MS - 1;
    for (let i = 0; i < 3; i += 1)
      office.engine.bus.publish({ kind: 'deploy', phase: 'healthy', subject: SITE, at: '' });
    expect(office.heard('hatTrick')).toHaveLength(1);
  });
});
