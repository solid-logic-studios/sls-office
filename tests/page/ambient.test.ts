import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../src/contract/snapshot.ts';
import type { AmbientBed, Theme } from '../../src/contract/theme.ts';
import type { CharacterView } from '../../src/engine/engine.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { MOOD_BUSYNESS, ambientMix, busyness, labLoad } from '../../src/page/audio/ambient-mix.ts';
import { ALARM_DUCK, Soundboard } from '../../src/page/audio/soundboard.ts';
import { Simulator, type SimCommand } from '../../src/simulator/simulator.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';
import { expectSaneSound } from '../support/sane-sound.ts';
import { MIDDAY } from '../support/midday.ts';

const BED: AmbientBed = {
  room: { volume: 0.02, lowpassHz: 400 },
  hum: { wave: 'sine', hz: 100, idle: 0.01, busy: 0.05 },
  clatter: { key: { notes: [] }, calm: 0.5, frantic: 8 },
};

function character(part: CharacterView['part'], mood: CharacterView['mood'], visible = true): CharacterView {
  return { id: `${part}-${mood}`, part, x: 0, y: 0, floor: 0, mood, pose: 'type', visible, status: '' };
}

/** The Simulator with nothing happening on its own, heard by a Soundboard over a real Engine. */
function simulate(theme: Theme) {
  const simulator = new Simulator({ random: () => 0.99, now: () => new Date(Date.UTC(2026, 10, 16, 9)) });
  const engine = new Engine(theme, { random: seededRandom(7) });
  const output = new RecordingSoundOutput();
  const timers: (() => void)[] = [];
  const soundboard = new Soundboard(engine, output, { later: (callback) => timers.push(callback), hour: MIDDAY });
  const play = (seconds: number): void => {
    for (let second = 0; second < seconds; second++) {
      simulator.advance(1);
      const snapshot = simulator.snapshot();
      engine.accept(snapshot);
      soundboard.endSnapshot(snapshot);
    }
  };
  const send = (command: SimCommand): void => simulator.dispatch(command);
  /** The latest mix the bed was set to. */
  const mix = () => output.ambients.at(-1)?.mix;
  return { output, soundboard, timers, play, send, mix };
}

describe('labLoad', () => {
  it('is the mean CPU of the VMs that are up, as 0 to 1', () => {
    const lab = new Lab();
    const snapshot: Snapshot = lab.snapshot();
    const vms = snapshot.vms.map((vm, index) => ({ ...vm, up: index < 2, cpu: index === 0 ? 20 : 60 }));
    expect(labLoad({ ...snapshot, vms })).toBeCloseTo(0.4);
  });

  it('is 0 when no VM is up, and clamped to 1', () => {
    const snapshot = new Lab().snapshot();
    expect(labLoad({ ...snapshot, vms: snapshot.vms.map((vm) => ({ ...vm, up: false })) })).toBe(0);
    expect(labLoad({ ...snapshot, vms: snapshot.vms.map((vm) => ({ ...vm, cpu: 250 })) })).toBe(1);
  });
});

describe('busyness', () => {
  it('weighs each visible worker and pod by mood and takes the mean', () => {
    const cast = [character('worker', 'swamped'), character('pod', 'working'), character('worker', 'break')];
    expect(busyness(cast)).toBeCloseTo((MOOD_BUSYNESS.swamped + MOOD_BUSYNESS.working + MOOD_BUSYNESS.break) / 3);
  });

  it('ignores hidden characters and the other parts, and is 0 with nobody typing', () => {
    expect(busyness([character('worker', 'swamped', false), character('greeter', 'swamped')])).toBe(0);
    expect(busyness([])).toBe(0);
  });

  it('orders the moods calm to frantic', () => {
    expect(MOOD_BUSYNESS.working).toBeLessThan(MOOD_BUSYNESS.stressed);
    expect(MOOD_BUSYNESS.stressed).toBeLessThan(MOOD_BUSYNESS.swamped);
    expect(MOOD_BUSYNESS.fainted).toBe(0);
  });
});

describe('ambientMix', () => {
  it('sits at the idle and calm ends with no load and no busyness', () => {
    expect(ambientMix(BED, 0, 0)).toEqual({ room: 0.02, hum: 0.01, keysPerSecond: 0.5 });
  });

  it('sits at the busy and frantic ends at full load and busyness', () => {
    expect(ambientMix(BED, 1, 1)).toEqual({ room: 0.02, hum: 0.05, keysPerSecond: 8 });
  });

  it('interpolates in between', () => {
    const mix = ambientMix(BED, 0.5, 0.5);
    expect(mix.hum).toBeCloseTo(0.03);
    expect(mix.keysPerSecond).toBeCloseTo(4.25);
  });
});

describe('the office ambient bed', () => {
  it('is defined with sane values', () => {
    const bed = officeTheme.soundscape?.ambient;
    expect(bed).toBeDefined();
    expectSaneSound(bed?.clatter.key);
    expect(bed?.hum.busy).toBeGreaterThan(bed?.hum.idle ?? 0);
    expect(bed?.clatter.frantic).toBeGreaterThan(bed?.clatter.calm ?? 0);
  });

  it('is left out of boxes', () => {
    expect(boxesTheme.soundscape?.ambient).toBeUndefined();
  });
});

describe('the ambient bed following the lab', () => {
  it('starts with the first Snapshot', () => {
    const office = simulate(officeTheme);
    office.play(1);
    expect(office.output.ambients).toHaveLength(1);
    expect(office.output.ambients[0]?.bed).toBe(officeTheme.soundscape?.ambient);
  });

  it('hums louder and clatters faster on a busy lab than a quiet one', () => {
    const office = simulate(officeTheme);
    office.send({ kind: 'preset', preset: 'quiet' });
    office.play(120);
    const quiet = office.mix();
    office.send({ kind: 'preset', preset: 'fire' });
    office.play(120);
    const fire = office.mix();
    expect(quiet).toBeDefined();
    expect(fire?.hum).toBeGreaterThan(quiet?.hum ?? 0);
    expect(fire?.keysPerSecond).toBeGreaterThan(quiet?.keysPerSecond ?? 0);
    expect(fire?.room).toBe(quiet?.room);
  });

  it('raises the hum as load is raised on a VM', () => {
    const office = simulate(officeTheme);
    office.send({ kind: 'preset', preset: 'quiet' });
    office.play(60);
    const before = office.mix()?.hum ?? 0;
    for (const vmId of ['sls-data', 'sls-compute', 'sls-deploy', 'sls-ci']) {
      office.send({ kind: 'set-load', vmId, cpu: 90, mem: 50 });
    }
    office.play(60);
    expect(office.mix()?.hum).toBeGreaterThan(before);
  });
});

describe('the ambient bed under an Alarm', () => {
  it('ducks ambient and effects together, then restores both after the Alarm', () => {
    const office = simulate(officeTheme);
    office.play(2);
    office.send({ kind: 'oom' });
    office.play(1);
    expect(office.output.levels).toEqual([
      { channel: 'effect', level: ALARM_DUCK },
      { channel: 'ambient', level: ALARM_DUCK },
    ]);
    office.output.levels.length = 0;
    // A copy: the snore loop re-arms itself on `later` as it fires.
    for (const restore of office.timers.splice(0)) restore();
    expect(office.output.levels).toEqual([
      { channel: 'effect', level: 1 },
      { channel: 'ambient', level: 1 },
    ]);
  });
});

describe('the ambient bed and mute', () => {
  it('switches the bed off on mute, once, and back on at once with the last mix on unmute', () => {
    const office = simulate(officeTheme);
    office.play(2);
    const last = office.output.ambients.at(-1);
    office.output.ambients.length = 0;

    office.soundboard.muted = true;
    expect(office.output.ambients.map((call) => call.bed)).toEqual([null]);
    // The clatter's key presses already scheduled are cut too.
    expect(office.output.stops).toContain('ambient');
    office.play(3);
    expect(office.output.ambients).toHaveLength(1);

    office.soundboard.muted = false;
    expect(office.output.ambients).toHaveLength(2);
    expect(office.output.ambients.at(-1)?.bed).toBe(last?.bed);
    expect(office.output.ambients.at(-1)?.mix).toBeDefined();
  });

  it('does not touch the bed on mute when none is running', () => {
    const office = simulate(boxesTheme);
    office.soundboard.muted = true;
    expect(office.output.ambients).toHaveLength(0);
  });
});

describe('a Theme without a bed', () => {
  it('never starts one', () => {
    const office = simulate(boxesTheme);
    office.play(5);
    expect(office.output.ambients).toHaveLength(0);
  });

  it('switches a running bed off once when the Theme changes to one without', () => {
    const engine = new Engine(officeTheme, { random: seededRandom(7) });
    const output = new RecordingSoundOutput();
    let theme: Theme = officeTheme;
    const soundboard = new Soundboard(
      {
        bus: engine.bus,
        get theme() {
          return theme;
        },
        get findings() {
          return engine.findings;
        },
        get layout() {
          return engine.layout;
        },
        characters: () => engine.characters(),
      },
      output,
      { hour: MIDDAY },
    );
    const lab = new Lab();
    const feed = (): void => {
      const snapshot = lab.snapshot();
      engine.accept(snapshot);
      soundboard.endSnapshot(snapshot);
    };
    feed();
    theme = boxesTheme;
    feed();
    feed();
    expect(output.ambients.map((call) => call.bed === null)).toEqual([false, true]);
  });
});
