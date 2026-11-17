import { describe, expect, it } from 'vitest';
import type { Cue, Theme } from '../src/contract/theme.ts';
import { Engine } from '../src/engine/engine.ts';
import { seededRandom } from '../src/engine/random.ts';
import { Simulator, type SimCommand } from '../src/simulator/simulator.ts';
import { THEMES } from '../src/themes/index.ts';
import { boxesTheme } from '../src/themes/boxes/index.ts';
import { officeTheme } from '../src/themes/office/index.ts';
import { VALID_FIXTURES, loadFixture } from './helpers.ts';
import { logged, record, run, said } from './support/lab.ts';
import { RecordingPainter } from './support/recording-painter.ts';

/**
 * Issue #2's acceptance criteria, end to end: the Simulator's Snapshots through the Engine, under
 * the Office theme and under the boxes theme, with no canvas.
 */

/** With a constant 0.99 the Simulator starts nothing on its own and every pick takes the last candidate. */
const PICKED_SITE = 'lab-test-api-develop';

function open(theme: Theme) {
  const simulator = new Simulator({ random: () => 0.99, now: () => new Date(Date.UTC(2026, 10, 16, 9)) });
  const engine = new Engine(theme, { random: seededRandom(7) });
  const events = record(engine.bus);
  /** One Snapshot a second, like the page in `?sim`. */
  const play = (seconds: number): void => {
    for (let second = 0; second < seconds; second++) {
      simulator.advance(1);
      engine.accept(simulator.snapshot());
      run(engine, 1);
    }
  };
  const send = (command: SimCommand): void => simulator.dispatch(command);
  const heard = (cue: Cue): boolean => said(events).some((line) => theme.lines.cue[cue].includes(line));
  const workers = () => engine.characters().filter((character) => character.part === 'worker');
  play(2);
  return { engine, events, play, send, heard, workers };
}

describe.each(THEMES)('the $name theme, driven by the Simulator', (theme) => {
  it('plays a healthy deploy: delivery, health check, handover', () => {
    const office = open(theme);
    office.send({ kind: 'deploy', outcome: 'healthy' });
    office.play(40);

    expect(logged(office.events)).toContain(`Deploy started: ${PICKED_SITE}`);
    expect(logged(office.events)).toContain(`Deploy healthy: ${PICKED_SITE} is on the new container`);
    for (const cue of ['delivery', 'new-arrival', 'health-check', 'healthy', 'old-one-out'] as const) {
      expect(office.heard(cue), cue).toBe(true);
    }
    const ids = office.workers().map((worker) => worker.id);
    expect(ids).not.toContain(PICKED_SITE);
    expect(ids.some((id) => id.startsWith(`${PICKED_SITE}#`))).toBe(true);
    expect(ids).toHaveLength(12);
  });

  it('plays a rolled-back deploy: the newcomer is sent home and the old worker stays', () => {
    const office = open(theme);
    office.send({ kind: 'deploy', outcome: 'rolled-back' });
    office.play(40);

    expect(logged(office.events).some((line) => line.startsWith(`Deploy rolled back: ${PICKED_SITE}`))).toBe(true);
    for (const cue of ['unhealthy', 'sent-home', 'still-serving'] as const) {
      expect(office.heard(cue), cue).toBe(true);
    }
    expect(office.heard('healthy')).toBe(false);
    expect(office.workers().map((worker) => worker.id)).toContain(PICKED_SITE);
    expect(office.workers()).toHaveLength(12);
  });

  it('plays a CI burst: three single-use pods appear, work and vanish', () => {
    const office = open(theme);
    const pods = () => office.engine.characters().filter((character) => character.part === 'pod');
    office.send({ kind: 'ci-burst' });
    office.play(4);
    expect(pods()).toHaveLength(3);
    expect(office.heard('pods-up')).toBe(true);

    office.play(16);
    expect(pods()).toHaveLength(0);
  });

  it('plays an OOM kill: the worker faints, then gets up again', () => {
    const office = open(theme);
    const victim = () => office.workers().find((worker) => worker.id === PICKED_SITE);
    office.send({ kind: 'oom' });
    office.play(1);
    expect(victim()?.mood).toBe('fainted');
    expect(victim()?.pose).toBe('faint');

    office.play(8);
    expect(victim()?.mood).not.toBe('fainted');
    expect(office.heard('recovered')).toBe(true);
  });

  it('plays a VM outage: the room goes offline, its workers are absent, and they come back', () => {
    const office = open(theme);
    office.send({ kind: 'set-up', vmId: 'sls-compute', up: false });
    office.play(2);
    expect(office.workers().every((worker) => worker.mood === 'absent' && !worker.visible)).toBe(true);
    expect(office.engine.roster().find((line) => line.startsWith('sls-compute'))).toContain(theme.lines.status.absent);
    const painter = new RecordingPainter();
    for (let frame = 0; frame < 20 && !painter.texts.includes(theme.lines.offline); frame++) {
      run(office.engine, 0.1);
      office.engine.draw(painter);
    }
    expect(painter.texts).toContain(theme.lines.offline);

    office.send({ kind: 'set-up', vmId: 'sls-compute', up: true });
    office.play(3);
    expect(office.workers().every((worker) => worker.visible)).toBe(true);
  });

  it('plays the backup vault run', () => {
    const office = open(theme);
    office.send({ kind: 'backup' });
    office.play(40);

    expect(logged(office.events)).toContain('Backup run started');
    expect(logged(office.events)).toContain('Backup run finished: the set is safe off-site');
    for (const cue of ['backup-start', 'backup-locked', 'backup-safe'] as const) {
      expect(office.heard(cue), cue).toBe(true);
    }
  });

  it('follows the mood thresholds: a quiet lab is on a break, a burning one is stressed', () => {
    const office = open(theme);
    office.send({ kind: 'preset', preset: 'quiet' });
    office.play(20);
    expect(office.workers().every((worker) => worker.mood === 'break')).toBe(true);

    office.send({ kind: 'preset', preset: 'fire' });
    office.play(20);
    expect(office.workers().some((worker) => worker.mood === 'stressed')).toBe(true);
  });

  it.each(VALID_FIXTURES)('renders the live fixture %s', (name) => {
    const engine = new Engine(theme);
    const fixture = loadFixture(name);
    engine.accept(fixture);
    run(engine, 1);
    const painter = new RecordingPainter();
    engine.draw(painter);

    expect(painter.rects.length).toBeGreaterThan(0);
    expect(engine.roster()).toHaveLength(fixture.vms.length);
    expect(engine.findings).toEqual(fixture.host.findings);
  });
});

describe('the Engine has no Office-specific code', () => {
  it('casts the same Snapshot the same way under both themes', () => {
    const cast = (theme: Theme): string[] =>
      open(theme)
        .engine.characters()
        .filter((character) => character.part !== 'founder')
        .map((character) => `${character.part}:${character.id}`)
        .sort();

    expect(cast(boxesTheme)).toEqual(cast(officeTheme));
    expect(cast(officeTheme)).toHaveLength(12 + 4 + 3);
  });

  it('puts the same characters in different places on a different layout', () => {
    const where = (theme: Theme): string =>
      JSON.stringify(
        open(theme)
          .engine.characters()
          .map((character) => [character.x, character.y]),
      );

    expect(where(boxesTheme)).not.toBe(where(officeTheme));
  });
});
