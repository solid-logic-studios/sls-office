import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { Soundboard } from '../../src/page/audio/soundboard.ts';
import type { Snapshot } from '../../src/contract/snapshot.ts';
import { Simulator, type SimCommand } from '../../src/simulator/simulator.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { Lab, backup, deploy, oom } from '../support/lab.ts';
import { RecordingSoundOutput } from '../support/recording-sound-output.ts';

const THEMES: readonly Theme[] = [officeTheme, boxesTheme];

/** A Soundboard over a real Engine, fed by `feed`, which stands in for the page's `show()`. */
function listen(theme: Theme) {
  const engine = new Engine(theme, { random: seededRandom(7) });
  const output = new RecordingSoundOutput();
  const clock = { ms: 0 };
  const soundboard = new Soundboard(engine, output, { now: () => clock.ms });
  const advance = (minutes: number): void => {
    clock.ms += minutes * 60 * 1000;
  };
  const feed = (snapshot: Snapshot): void => {
    engine.accept(snapshot);
    soundboard.endSnapshot();
  };
  return { engine, output, soundboard, feed, advance };
}

/** The Simulator with nothing happening on its own, played a Snapshot a second like `?sim`. */
function simulate(theme: Theme) {
  const simulator = new Simulator({ random: () => 0.99, now: () => new Date(Date.UTC(2026, 10, 16, 9)) });
  const heard = listen(theme);
  const play = (seconds: number): void => {
    for (let second = 0; second < seconds; second++) {
      simulator.advance(1);
      heard.feed(simulator.snapshot());
    }
  };
  const send = (command: SimCommand): void => simulator.dispatch(command);
  play(2);
  return { ...heard, play, send };
}

describe.each(THEMES)('the Soundboard under the $name theme', (theme) => {
  const alarm = theme.soundscape?.alarm;

  it('has an Alarm to sound', () => {
    expect(alarm).toBeDefined();
  });

  it('sounds the Alarm once for an OOM kill', () => {
    const office = simulate(theme);
    office.send({ kind: 'oom' });
    office.play(1);
    expect(office.output.played).toHaveLength(1);
    expect(office.output.played[0]?.sound).toBe(alarm);
    expect(office.output.played[0]?.options).toEqual({ volume: 1, pan: 0 });
  });

  it('sounds the Alarm once for a VM going down', () => {
    const office = simulate(theme);
    office.send({ kind: 'vm-down' });
    office.play(1);
    expect(office.output.played).toHaveLength(1);
    expect(office.output.played[0]?.sound).toBe(alarm);
  });

  it('sounds the Alarm once for a rolled-back deploy, and not for a healthy one', () => {
    const office = simulate(theme);
    office.send({ kind: 'deploy', outcome: 'healthy' });
    office.play(40);
    expect(office.output.played).toHaveLength(0);

    office.send({ kind: 'deploy', outcome: 'rolled-back' });
    office.play(40);
    expect(office.output.played).toHaveLength(1);
    expect(office.output.played[0]?.sound).toBe(alarm);
  });

  it('sounds the Alarm once for a failed backup, and not for a good one', () => {
    const office = simulate(theme);
    office.send({ kind: 'backup' });
    office.play(40);
    expect(office.output.played).toHaveLength(0);

    office.send({ kind: 'set-up', vmId: 'sls-data', up: false });
    office.play(1);
    expect(office.output.played).toHaveLength(1); // the VM going down alarms by itself
    office.output.clear();

    office.send({ kind: 'backup' });
    office.play(1);
    expect(office.output.played).toHaveLength(1);
    expect(office.output.played[0]?.sound).toBe(alarm);
  });

  // The Simulator cannot raise `crit` without also taking a VM down, so these use the Lab helper.
  it('sounds the Alarm once when crit rises from 0, and not while it stays up', () => {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);

    lab.findings = { ok: 9, warn: 0, crit: 1 };
    for (let i = 0; i < 20; i++) office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(1);
    expect(office.output.played[0]?.sound).toBe(alarm);
  });

  it('sounds again when crit falls to 0 and rises again', () => {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    lab.findings = { ok: 9, warn: 0, crit: 1 };
    office.feed(lab.snapshot());
    lab.findings = { ok: 10, warn: 0, crit: 0 };
    office.feed(lab.snapshot());
    lab.findings = { ok: 9, warn: 0, crit: 2 };
    office.feed(lab.snapshot());
    expect(office.output.played.map((play) => play.sound)).toEqual([
      theme.soundscape?.alarm,
      theme.soundscape?.allClear,
      theme.soundscape?.alarm,
    ]);
  });

  it('does not sound on the first Snapshot, even with crit already above 0', () => {
    const lab = new Lab();
    lab.findings = { ok: 8, warn: 0, crit: 2 };
    const office = listen(theme);
    office.feed(lab.snapshot());
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);
  });

  it('does not sound again when the same Snapshot is read twice', () => {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    const failing = lab.snapshot([oom('lab-test-api-develop')]);
    office.feed(failing);
    office.feed(failing);
    expect(office.output.played).toHaveLength(1);
  });

  it('coalesces several triggers in one Snapshot into one Alarm', () => {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    lab.findings = { ok: 9, warn: 0, crit: 1 };
    office.feed(
      lab.snapshot([
        oom('lab-test-api-develop'),
        deploy('rolled-back', 'lab-test-web-develop'),
        backup('failed'),
        { kind: 'vm-down', subject: 'sls-ci', at: '' },
      ]),
    );
    expect(office.output.played).toHaveLength(1);
  });

  it('sounds only when the page ends the Snapshot, and then once', () => {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    office.engine.accept(lab.snapshot([oom('lab-test-api-develop')]));
    expect(office.output.played).toHaveLength(0);
    office.soundboard.endSnapshot();
    office.soundboard.endSnapshot();
    expect(office.output.played).toHaveLength(1);
  });

  it('stops sounding after dispose', () => {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    office.soundboard.dispose();
    office.feed(lab.snapshot([oom('lab-test-api-develop')]));
    expect(office.output.played).toHaveLength(0);
  });
});

describe.each(THEMES)('the Soundboard Reminder and All-clear under the $name theme', (theme) => {
  const { alarm, reminder, allClear } = theme.soundscape ?? {};
  const vmUpEvent = { kind: 'vm-up', subject: 'sls-ci', at: '' } as const;

  /** A page that has seen a calm lab and then a critical finding open, at minute 0. */
  function critOpen() {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    lab.findings = { ok: 9, warn: 0, crit: 1 };
    office.feed(lab.snapshot());
    office.output.clear();
    return { lab, office };
  }

  it('sounds the Reminder at 10 minutes and again at 20, not before', () => {
    const { lab, office } = critOpen();
    office.advance(9.98);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);

    office.advance(0.02);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(1);
    expect(office.output.played[0]?.sound).toBe(reminder);
    expect(office.output.played[0]?.options).toEqual({ volume: 1, pan: 0 });

    office.advance(9.98);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(1);
    office.advance(0.02);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(2);
    expect(office.output.played[1]?.sound).toBe(reminder);
  });

  it('stops the Reminder when crit returns to 0', () => {
    const { lab, office } = critOpen();
    lab.findings = { ok: 10, warn: 0, crit: 0 };
    office.feed(lab.snapshot());
    office.output.clear();
    for (let i = 0; i < 6; i++) {
      office.advance(5);
      office.feed(lab.snapshot());
    }
    expect(office.output.played).toHaveLength(0);
  });

  it('reminds 10 minutes after a page opened on an open finding, with no Alarm', () => {
    const lab = new Lab();
    lab.findings = { ok: 8, warn: 0, crit: 2 };
    const office = listen(theme);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);
    office.advance(9.98);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);
    office.advance(0.02);
    office.feed(lab.snapshot());
    expect(office.output.played.map((play) => play.sound)).toEqual([reminder]);
  });

  it('does not reset the Reminder clock for an Alarm while crit stays open', () => {
    const { lab, office } = critOpen();
    office.advance(6);
    office.feed(lab.snapshot([oom('lab-test-api-develop')]));
    expect(office.output.played.map((play) => play.sound)).toEqual([alarm]);
    office.advance(4);
    office.feed(lab.snapshot());
    expect(office.output.played.map((play) => play.sound)).toEqual([alarm, reminder]);
  });

  it('sounds one All-clear when a VM comes back through the Simulator', () => {
    const office = simulate(theme);
    office.send({ kind: 'set-up', vmId: 'sls-data', up: false });
    office.play(1);
    expect(office.output.played.map((play) => play.sound)).toContain(alarm);
    office.output.clear();

    office.send({ kind: 'set-up', vmId: 'sls-data', up: true });
    office.play(1);
    expect(office.output.played).toHaveLength(1);
    expect(office.output.played[0]?.sound).toBe(allClear);
    expect(office.output.played[0]?.options).toEqual({ volume: 1, pan: 0 });
  });

  it('sounds the All-clear when crit falls to 0, and not on the first Snapshot', () => {
    const lab = new Lab();
    lab.findings = { ok: 8, warn: 0, crit: 2 };
    const office = listen(theme);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);

    lab.findings = { ok: 10, warn: 0, crit: 0 };
    office.feed(lab.snapshot());
    office.feed(lab.snapshot());
    expect(office.output.played.map((play) => play.sound)).toEqual([allClear]);
  });

  it('does not sound the All-clear on a first Snapshot with crit at 0', () => {
    const office = listen(theme);
    office.feed(new Lab().snapshot());
    expect(office.output.played).toHaveLength(0);
  });

  it('lets the Alarm win over the All-clear in the same Snapshot', () => {
    const lab = new Lab();
    const office = listen(theme);
    office.feed(lab.snapshot());
    office.feed(lab.snapshot([vmUpEvent, oom('lab-test-api-develop')]));
    expect(office.output.played.map((play) => play.sound)).toEqual([alarm]);
  });

  it('drops a Reminder that falls due beside an All-clear, and does not owe it', () => {
    const { lab, office } = critOpen();
    office.advance(10);
    office.feed(lab.snapshot([vmUpEvent]));
    expect(office.output.played.map((play) => play.sound)).toEqual([allClear]);
    office.advance(5);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(1);
  });

  it('sounds no Reminder or All-clear while muted, and replays nothing on unmute', () => {
    const { lab, office } = critOpen();
    office.soundboard.muted = true;
    office.advance(10);
    office.feed(lab.snapshot());
    lab.findings = { ok: 10, warn: 0, crit: 0 };
    office.feed(lab.snapshot([vmUpEvent]));
    office.soundboard.muted = false;
    office.feed(lab.snapshot());
    office.advance(30);
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);
  });
});

describe('the Soundboard under a Theme with no Soundscape', () => {
  it('is silent', () => {
    const lab = new Lab();
    const office = listen({ ...boxesTheme, soundscape: undefined });
    office.feed(lab.snapshot());
    lab.findings = { ok: 9, warn: 0, crit: 1 };
    office.feed(lab.snapshot([oom('lab-test-api-develop')]));
    expect(office.output.played).toHaveLength(0);
  });

  it('follows a theme switch', () => {
    const lab = new Lab();
    const office = listen(officeTheme);
    office.feed(lab.snapshot());
    office.engine.setTheme(boxesTheme);
    office.feed(lab.snapshot([oom('lab-test-api-develop')]));
    expect(office.output.played[0]?.sound).toBe(boxesTheme.soundscape?.alarm);
  });
});

describe('the Soundboard while muted', () => {
  it('plays no Alarm', () => {
    const lab = new Lab();
    const office = listen(officeTheme);
    office.soundboard.muted = true;
    office.feed(lab.snapshot());
    office.feed(lab.snapshot([oom('lab-test-api-develop')]));
    expect(office.output.played).toHaveLength(0);
  });

  it('sounds the next new trigger once unmuted', () => {
    const lab = new Lab();
    const office = listen(officeTheme);
    office.soundboard.muted = true;
    office.feed(lab.snapshot());
    office.soundboard.muted = false;
    office.feed(lab.snapshot([oom('lab-test-api-develop')]));
    expect(office.output.played).toHaveLength(1);
  });

  it('does not replay an Alarm that fired while muted', () => {
    const lab = new Lab();
    const office = listen(officeTheme);
    office.feed(lab.snapshot());
    office.soundboard.muted = true;
    office.feed(lab.snapshot([oom('lab-test-api-develop')]));
    office.soundboard.muted = false;
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);
  });

  it('does not sound on unmute for a crit edge that happened while muted', () => {
    const lab = new Lab();
    const office = listen(officeTheme);
    office.feed(lab.snapshot());
    office.soundboard.muted = true;
    lab.findings = { ok: 9, warn: 0, crit: 1 };
    office.feed(lab.snapshot());
    office.soundboard.muted = false;
    office.feed(lab.snapshot());
    expect(office.output.played).toHaveLength(0);
  });
});
