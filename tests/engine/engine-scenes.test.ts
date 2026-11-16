import { describe, expect, it } from 'vitest';
import type { StageView, Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { TICK_COLOUR } from '../../src/engine/effects.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { Lab, backup, logged, pod, record, run, said } from '../support/lab.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

const KEEPER = 'sls-data';
const WRANGLER = 'sls-ci';
const KEEPER_POST = boxesTheme.layout.homes.keeper[0];

/** The boxes Theme, with a back decor that keeps the last stage view it was given. */
function watched(): { theme: Theme; last: () => StageView | undefined } {
  const views: StageView[] = [];
  const theme: Theme = { ...boxesTheme, decor: { ...boxesTheme.decor, back: [(_painter, view) => views.push(view)] } };
  return { theme, last: () => views.at(-1) };
}

function setUp(theme: Theme = boxesTheme) {
  const lab = new Lab();
  const engine = new Engine(theme);
  const events = record(engine.bus);
  engine.accept(lab.snapshot());
  const find = (id: string) => engine.characters().find((character) => character.id === id);
  return { lab, engine, events, find };
}

describe('Vault run', () => {
  it('wheels the strongbox to the vault, waits for the outcome, and walks home', () => {
    const { theme, last } = watched();
    const { lab, engine, events, find } = setUp(theme);
    engine.accept(lab.snapshot([backup('started')]));
    expect(said(events, KEEPER)).toEqual(['BACKUP']);
    expect(find(KEEPER)?.status).toBe('BACKING UP');
    expect(logged(events)).toContain('Backup run started');

    const vaultOpen = () => {
      engine.draw(new RecordingPainter());
      return last()?.vaultOpen === true;
    };
    expect(run(engine, 30, vaultOpen)).toBe(true);
    expect(said(events, KEEPER)).toEqual(['BACKUP', 'LOCKED']);
    expect(find(KEEPER)?.x).toBe(boxesTheme.layout.vault.x);
    run(engine, 5);
    expect(vaultOpen()).toBe(true);

    engine.accept(lab.snapshot([backup('finished')]));
    expect(run(engine, 3, () => said(events, KEEPER).includes('SAFE'))).toBe(true);
    expect(logged(events)).toContain('Backup run finished: the set is safe off-site');
    // Ambient queries can send the keeper off again once home, so catch it on arrival.
    expect(run(engine, 15, () => find(KEEPER)?.x === KEEPER_POST?.seat.x)).toBe(true);
    expect(vaultOpen()).toBe(false);
    expect(find(KEEPER)?.status).toBe('WORKING');
  });

  it('stands still at the vault and the stores, and types again once back at its desk', () => {
    const { lab, engine, find } = setUp();
    const { vault } = boxesTheme.layout;
    run(engine, 0.1);
    expect(find(KEEPER)?.pose).toBe('type');
    engine.accept(lab.snapshot([backup('started')]));
    expect(run(engine, 30, () => find(KEEPER)?.x === vault.x)).toBe(true);
    expect(find(KEEPER)?.pose).toBe('stand');
    run(engine, 3);
    expect(find(KEEPER)?.pose).toBe('stand');

    engine.accept(lab.snapshot([backup('finished')]));
    expect(run(engine, 15, () => find(KEEPER)?.x === KEEPER_POST?.seat.x)).toBe(true);
    run(engine, 0.2);
    expect(find(KEEPER)?.pose).toBe('type');
  });

  it('says so when the backup fails', () => {
    const { lab, engine, events } = setUp();
    engine.accept(lab.snapshot([backup('started')]));
    run(engine, 5);
    engine.accept(lab.snapshot([backup('failed')]));
    expect(run(engine, 30, () => said(events, KEEPER).includes('FAILED'))).toBe(true);
    expect(said(events, KEEPER)).not.toContain('SAFE');
    expect(logged(events)).toContain('Backup failed');
  });

  it('plays the whole run for an outcome whose start was missed', () => {
    const { lab, engine, events, find } = setUp();
    engine.accept(lab.snapshot([backup('finished')]));
    expect(said(events, KEEPER)).toEqual(['BACKUP']);
    expect(run(engine, 30, () => said(events, KEEPER).includes('SAFE'))).toBe(true);
    expect(run(engine, 15, () => find(KEEPER)?.x === KEEPER_POST?.seat.x)).toBe(true);
  });

  it("is abandoned when the keeper's VM goes down", () => {
    const { lab, engine, events, find } = setUp();
    engine.accept(lab.snapshot([backup('started')]));
    run(engine, 4);
    lab.vm('data').up = false;
    engine.accept(lab.snapshot());
    run(engine, 0.5);
    expect(logged(events)).toContain("Backup run abandoned: the keeper's VM went down");
    lab.vm('data').up = true;
    engine.accept(lab.snapshot());
    run(engine, 1);
    expect(find(KEEPER)).toMatchObject({ visible: true, x: KEEPER_POST?.seat.x, status: 'WORKING' });
  });
});

describe('Pod run', () => {
  it('brings each new pod in from the spawn point to its bench, and the wrangler says so once', () => {
    const { lab, engine, events, find } = setUp();
    lab.vm('ci').workloads.push(pod('pod-1'), pod('pod-2'));
    engine.accept(lab.snapshot());
    expect(said(events, WRANGLER)).toEqual(['PODS UP']);
    expect(logged(events)).toContain('CI burst: 2 single-use pods started');
    expect(find('pod-1')?.x).toBe(boxesTheme.layout.podSpawn.x);

    run(engine, 5);
    const benches = boxesTheme.layout.homes.pod;
    expect(find('pod-1')).toMatchObject({ x: benches[0]?.seat.x, pose: 'type' });
    expect(find('pod-2')).toMatchObject({ x: benches[1]?.seat.x, pose: 'type' });

    // The same document again does not replay anything.
    engine.accept(lab.snapshot());
    expect(said(events, WRANGLER)).toEqual(['PODS UP']);
  });

  it('lets a new pod take the bench of one leaving in the same Snapshot', () => {
    const { lab, engine, find } = setUp();
    const benches = boxesTheme.layout.homes.pod;
    lab.vm('ci').workloads.push(pod('pod-1'), pod('pod-2'), pod('pod-3'));
    engine.accept(lab.snapshot());
    run(engine, 5);
    expect(find('pod-1')?.x).toBe(benches[0]?.seat.x);

    lab.remove('pod-1');
    lab.vm('ci').workloads.push(pod('pod-4'));
    engine.accept(lab.snapshot());
    // It is on stage at once, coming in from the spawn point as a pod run plays.
    expect(find('pod-4')).toMatchObject({ x: boxesTheme.layout.podSpawn.x, visible: true });
    run(engine, 5);
    expect(find('pod-1')).toBeUndefined();
    expect(find('pod-4')).toMatchObject({ x: benches[0]?.seat.x, pose: 'type' });
    expect(find('pod-2')?.x).toBe(benches[1]?.seat.x);
  });

  it('ticks, puffs and is gone when its job is done', () => {
    const { lab, engine, find } = setUp();
    lab.vm('ci').workloads.push(pod('pod-1'));
    engine.accept(lab.snapshot());
    run(engine, 5);
    lab.remove('pod-1');
    engine.accept(lab.snapshot());
    run(engine, 0.1);
    expect(find('pod-1')).toBeUndefined();
    const painter = new RecordingPainter();
    engine.draw(painter);
    expect(painter.rects.some((rect) => rect.colour === TICK_COLOUR)).toBe(true);
  });

  it('says pods-up once per Snapshot that adds pods', () => {
    const { lab, engine, events } = setUp();
    lab.vm('ci').workloads.push(pod('pod-1'));
    engine.accept(lab.snapshot());
    run(engine, 3);
    lab.vm('ci').workloads.push(pod('pod-2'), pod('pod-3'));
    engine.accept(lab.snapshot());
    expect(said(events, WRANGLER).filter((text) => text === 'PODS UP')).toHaveLength(2);
  });
});
