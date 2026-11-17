import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../src/contract/snapshot.ts';
import type { EffectName, Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { ALARM_DUCK, Soundboard } from '../../src/page/audio/soundboard.ts';
import { soundSeconds } from '../../src/page/audio/sound-output.ts';
import { EFFECT_THROTTLE_MS } from '../../src/page/audio/stage-effects.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab, oom } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { timersFor } from '../support/timers.ts';
import { expectSaneSound } from '../support/sane-sound.ts';

const EFFECT_NAMES: readonly EffectName[] = [
  'deployStarted',
  'deployHealthy',
  'paper',
  'visitor',
  'checkIn',
  'workloadAdded',
  'workloadRemoved',
  'backupStarted',
  'backupFinished',
  'snore',
  'streak',
  'smoko',
  'hatTrick',
];

/** A Soundboard over a real Engine with a Lab's cast on stage, a fake clock and a fake `later`. */
function listen(theme: Theme) {
  const engine = new Engine(theme, { random: seededRandom(7) });
  const output = new RecordingSoundOutput();
  const clock = { ms: 0 };
  const timers: { callback: () => void; ms: number }[] = [];
  const soundboard = new Soundboard(engine, output, {
    now: () => clock.ms,
    later: (callback, ms) => timers.push({ callback, ms }),
  });
  const lab = new Lab();
  engine.accept(lab.snapshot());
  const advance = (ms: number): void => {
    clock.ms += ms;
  };
  /** What the page's `show()` does: the Engine takes the Snapshot, then the Soundboard hears of it. */
  const feed = (snapshot: Snapshot): void => {
    engine.accept(snapshot);
    soundboard.endSnapshot(snapshot);
  };
  return { engine, output, soundboard, lab, timers, advance, feed };
}

describe.each([officeTheme, boxesTheme])('the $name Soundscape effects', (theme) => {
  it('defines at least one sane effect', () => {
    const effects = Object.values(theme.soundscape?.effects ?? {});
    expect(effects.length).toBeGreaterThan(0);
    for (const sound of effects) expectSaneSound(sound);
  });
});

describe('the office Soundscape effects', () => {
  it.each(EFFECT_NAMES)('defines a sane %s', (name) => {
    expectSaneSound(officeTheme.soundscape?.effects?.[name]);
  });
});

describe('stage effects under the office theme', () => {
  const effects = officeTheme.soundscape?.effects ?? {};

  it('sounds each bus event as its effect, on the effect channel', () => {
    const { engine, output, advance } = listen(officeTheme);
    const worker = engine.characters().find((character) => character.part === 'worker');
    const id = worker?.id ?? '';
    const { bus } = engine;
    bus.publish({ kind: 'deploy', phase: 'started', subject: id, at: '' });
    bus.publish({ kind: 'deploy', phase: 'healthy', subject: id, at: '' });
    bus.publish({ kind: 'paper', fromId: id, toId: id });
    bus.publish({ kind: 'visitor', targetId: id });
    bus.publish({ kind: 'check-in', fromId: id, toId: id });
    bus.publish({ kind: 'backup', phase: 'started', at: '' });
    advance(EFFECT_THROTTLE_MS);
    bus.publish({ kind: 'backup', phase: 'finished', at: '' });
    expect(output.played.map((play) => play.sound)).toEqual([
      effects.deployStarted,
      effects.deployHealthy,
      effects.paper,
      effects.visitor,
      effects.checkIn,
      effects.backupStarted,
      effects.backupFinished,
    ]);
    expect(output.played.every((play) => play.options.channel === 'effect')).toBe(true);
  });

  it('treats a rolled-back deploy and a failed backup as Alarms, not effects', () => {
    const { engine, output } = listen(officeTheme);
    engine.bus.publish({ kind: 'deploy', phase: 'rolled-back', subject: 'x', at: '' });
    engine.bus.publish({ kind: 'backup', phase: 'failed', at: '' });
    expect(output.played).toHaveLength(0);
  });

  it('pans by x: a left character sounds left of a right one', () => {
    const { engine, output, advance } = listen(officeTheme);
    const ground = engine
      .characters()
      .filter((character) => character.floor === 0 && character.visible && character.part === 'worker')
      .sort((a, b) => a.x - b.x);
    const left = ground[0];
    const right = ground.at(-1);
    if (left === undefined || right === undefined) throw new Error('no workers on the ground floor');
    expect(left.x).toBeLessThan(right.x);
    engine.bus.publish({ kind: 'paper', fromId: left.id, toId: right.id });
    advance(EFFECT_THROTTLE_MS);
    engine.bus.publish({ kind: 'paper', fromId: right.id, toId: left.id });
    const [first, second] = output.played;
    expect(first?.options.pan).toBeLessThan(0);
    expect(second?.options.pan).toBeGreaterThan(0);
    expect(first?.options.volume).toBe(1);
  });

  it('is quieter on another floor', () => {
    const { engine, output, advance } = listen(officeTheme);
    const characters = engine.characters();
    const downstairs = characters.find((character) => character.floor === 0 && character.visible);
    const upstairs = characters.find((character) => character.floor === 1 && character.visible);
    if (downstairs === undefined || upstairs === undefined) throw new Error('need a character on each floor');
    engine.bus.publish({ kind: 'visitor', targetId: downstairs.id });
    advance(EFFECT_THROTTLE_MS);
    engine.bus.publish({ kind: 'visitor', targetId: upstairs.id });
    const [ground, above] = output.played;
    expect(above?.options.volume).toBeLessThan(ground?.options.volume ?? 0);
  });

  it('centres an effect from someone it cannot find, at full volume', () => {
    const { engine, output } = listen(officeTheme);
    engine.bus.publish({ kind: 'visitor', targetId: 'nobody' });
    expect(output.played[0]?.options).toEqual({ channel: 'effect', volume: 1, pan: 0 });
  });

  it('places a backup at the keeper', () => {
    const { engine, output } = listen(officeTheme);
    const keeper = engine.characters().find((character) => character.part === 'keeper');
    engine.bus.publish({ kind: 'backup', phase: 'started', at: '' });
    const expectedPan = ((keeper?.x ?? 0) / engine.layout.width) * 2 - 1;
    expect(output.played[0]?.options.pan).toBeCloseTo(expectedPan);
  });

  it('sounds a workload arriving and leaving at its character', () => {
    const { engine, output, lab, advance } = listen(officeTheme);
    const workload = lab.siteInstance('lab-test-api-develop');
    engine.bus.publish({ kind: 'workload-added', vmId: 'sls-compute', workload });
    advance(EFFECT_THROTTLE_MS);
    engine.bus.publish({ kind: 'workload-removed', vmId: 'sls-compute', workload });
    expect(output.played.map((play) => play.sound)).toEqual([effects.workloadAdded, effects.workloadRemoved]);
  });

  it('sounds the same effect at most once per 1.5 s, and other effects independently', () => {
    const { engine, output, advance } = listen(officeTheme);
    const { bus } = engine;
    bus.publish({ kind: 'visitor', targetId: 'a' });
    advance(EFFECT_THROTTLE_MS - 1);
    bus.publish({ kind: 'visitor', targetId: 'a' });
    bus.publish({ kind: 'paper', fromId: 'a', toId: 'b' });
    expect(output.played.map((play) => play.sound)).toEqual([effects.visitor, effects.paper]);
    advance(1);
    bus.publish({ kind: 'visitor', targetId: 'a' });
    expect(output.played).toHaveLength(3);
  });

  it('is silent for an effect the Theme leaves out', () => {
    const { engine, output } = listen({ ...officeTheme, soundscape: undefined });
    engine.bus.publish({ kind: 'visitor', targetId: 'a' });
    expect(output.played).toHaveLength(0);
  });

  it('stops sounding after dispose', () => {
    const { engine, output, soundboard } = listen(officeTheme);
    soundboard.dispose();
    engine.bus.publish({ kind: 'visitor', targetId: 'a' });
    expect(output.played).toHaveLength(0);
  });
});

describe('the Alarm ducking stage effects', () => {
  const alarmSeconds = soundSeconds(officeTheme.soundscape?.alarm ?? { notes: [] });

  it('sums a sound from its notes', () => {
    expect(
      soundSeconds({
        notes: [
          { wave: 'sine', startHz: 1, endHz: 1, volume: 1, attack: 0.1, sustain: 0.2, decay: 0.3, gap: 0.4 },
          { wave: 'sine', startHz: 1, endHz: 1, volume: 1, attack: 1, sustain: 1, decay: 1 },
        ],
      }),
    ).toBeCloseTo(4);
  });

  it('ducks effects for the Alarm, then restores them after its length', () => {
    const { output, lab, timers, feed } = listen(officeTheme);
    feed(lab.snapshot());
    feed(lab.snapshot([oom('lab-test-api-develop')]));
    expect(output.levels).toEqual([
      { channel: 'effect', level: ALARM_DUCK },
      { channel: 'ambient', level: ALARM_DUCK },
    ]);
    const restore = timersFor(timers, alarmSeconds);
    expect(restore).toHaveLength(1);
    restore[0]?.callback();
    expect(output.levels.slice(-2)).toEqual([
      { channel: 'effect', level: 1 },
      { channel: 'ambient', level: 1 },
    ]);
  });

  it('does not let the first Alarm restore the level under a second', () => {
    const { output, lab, timers, feed } = listen(officeTheme);
    feed(lab.snapshot());
    for (let i = 0; i < 2; i++) {
      feed(lab.snapshot([oom('lab-test-api-develop')]));
    }
    const restores = timersFor(timers, alarmSeconds);
    expect(restores).toHaveLength(2);
    restores[0]?.callback();
    expect(output.levels.every((change) => change.level === ALARM_DUCK)).toBe(true);
    restores[1]?.callback();
    expect(output.levels.slice(-2).map((change) => change.level)).toEqual([1, 1]);
  });

  it('leaves the effect level alone for a Reminder', () => {
    const { output, lab, advance, feed } = listen(officeTheme);
    feed(lab.snapshot());
    lab.findings = { ok: 9, warn: 0, crit: 1 };
    feed(lab.snapshot());
    output.clear();
    advance(10 * 60 * 1000);
    feed(lab.snapshot());
    expect(output.played).toHaveLength(1);
    expect(output.levels).toHaveLength(0);
  });
});

describe('stage effects while muted', () => {
  it('stops both channels on mute and plays no effect until unmuted', () => {
    const { engine, output, soundboard, advance } = listen(officeTheme);
    soundboard.muted = true;
    expect(output.stops).toEqual(['alarm', 'effect']);
    engine.bus.publish({ kind: 'visitor', targetId: 'a' });
    expect(output.played).toHaveLength(0);
    soundboard.muted = false;
    advance(EFFECT_THROTTLE_MS);
    engine.bus.publish({ kind: 'visitor', targetId: 'a' });
    expect(output.played).toHaveLength(1);
  });

  it('reads back the muted flag', () => {
    const { soundboard } = listen(officeTheme);
    expect(soundboard.muted).toBe(false);
    soundboard.muted = true;
    expect(soundboard.muted).toBe(true);
  });
});
