import { describe, expect, it } from 'vitest';
import { Engine, type CharacterView } from '../../src/engine/engine.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { Lab, SITE_IDS, record, run, site } from '../support/lab.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

function byId(engine: Engine, id: string): CharacterView | undefined {
  return engine.characters().find((character) => character.id === id);
}

function parts(engine: Engine): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const character of engine.characters()) counts[character.part] = (counts[character.part] ?? 0) + 1;
  return counts;
}

describe('Engine cast and homes', () => {
  it('casts the base lab: a character per worker, service and VM part, plus the founders', () => {
    const engine = new Engine(boxesTheme);
    engine.accept(new Lab().snapshot());
    expect(parts(engine)).toEqual({
      founder: 2,
      keeper: 1,
      worker: 12,
      greeter: 1,
      guard: 2,
      checker: 1,
      courier: 1,
      wrangler: 1,
    });
    expect(engine.characters().every((character) => character.visible)).toBe(true);
  });

  it('seats each worker at the next free desk, in Snapshot order', () => {
    const engine = new Engine(boxesTheme);
    engine.accept(new Lab().snapshot());
    const desks = boxesTheme.layout.homes.worker;
    SITE_IDS.forEach((id, index) => expect(byId(engine, id)?.x).toBe(desks[index]?.seat.x));
  });

  it('gives a thirteenth worker no character, as there is no desk left', () => {
    const lab = new Lab();
    lab.vm('compute').workloads.push(site('extra-site-develop'));
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    expect(byId(engine, 'extra-site-develop')).toBeUndefined();
    expect(parts(engine).worker).toBe(12);
  });

  it('casts a workload that arrives later, at the desk a leaver freed', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    lab.remove('scrd-client-develop');
    lab.vm('compute').workloads.push(site('late-site-develop'));
    engine.accept(lab.snapshot());
    // No desk yet: the leaver still holds it until it has gone.
    expect(byId(engine, 'late-site-develop')).toBeUndefined();
    run(engine, 0.2);
    engine.accept(lab.snapshot());
    expect(byId(engine, 'late-site-develop')?.x).toBe(boxesTheme.layout.homes.worker[1]?.seat.x);
  });

  it('lets a removed workload leave', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    lab.remove('scrd-server-develop');
    engine.accept(lab.snapshot());
    run(engine, 0.2);
    expect(byId(engine, 'scrd-server-develop')).toBeUndefined();
  });

  it("hides a down VM's characters and brings them back when it is up again", () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    const events = record(engine.bus);
    engine.accept(lab.snapshot());
    lab.vm('compute').up = false;
    engine.accept(lab.snapshot());
    run(engine, 0.5);
    const worker = byId(engine, 'scrd-server-develop');
    expect(worker).toMatchObject({ visible: false, mood: 'absent', status: 'ABSENT' });
    expect(byId(engine, 'gatus')?.visible).toBe(false);
    expect(byId(engine, 'sls-data')?.visible).toBe(true);

    lab.vm('compute').up = true;
    engine.accept(lab.snapshot());
    run(engine, 0.5);
    expect(byId(engine, 'scrd-server-develop')).toMatchObject({ visible: true, mood: 'working' });
    expect(events).toContainEqual({ kind: 'log', text: 'sls-compute went down' });
    expect(events).toContainEqual({ kind: 'log', text: 'sls-compute is back up' });
  });

  it('dims a down room and labels it offline', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    lab.vm('ci').up = false;
    engine.accept(lab.snapshot());
    const painter = new RecordingPainter();
    engine.draw(painter);
    expect(painter.texts).toContain('OFFLINE');
    const room = boxesTheme.layout.rooms.ci;
    expect(painter.rects).toContainEqual(expect.objectContaining({ x: room.x, y: room.y, w: room.w, h: room.h }));
    // It blinks.
    run(engine, 0.5);
    const later = new RecordingPainter();
    engine.draw(later);
    expect(later.texts).not.toContain('OFFLINE');
  });

  it('refreshes moods from each Snapshot', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    lab.workload('scrd-server-develop').cpu = 95;
    engine.accept(lab.snapshot());
    run(engine, 0.1);
    expect(byId(engine, 'scrd-server-develop')?.mood).toBe('stressed');
  });

  it('writes a roster line per VM', () => {
    const lab = new Lab();
    lab.vm('ci').up = false;
    const engine = new Engine(boxesTheme);
    expect(engine.roster()).toEqual([]);
    engine.accept(lab.snapshot());
    expect(engine.roster()).toEqual([
      'sls-data: WORKING, cpu 40%',
      'sls-compute: WORKING, cpu 40%',
      'sls-deploy: WORKING, cpu 40%',
      'sls-ci: ABSENT, cpu n/a',
    ]);
  });

  it('reports findings and the layout', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    expect(engine.findings).toEqual({ ok: 0, warn: 0, crit: 0 });
    lab.findings = { ok: 3, warn: 2, crit: 1 };
    engine.accept(lab.snapshot());
    expect(engine.findings).toEqual({ ok: 3, warn: 2, crit: 1 });
    expect(engine.layout).toBe(boxesTheme.layout);
    expect(engine.theme).toBe(boxesTheme);
  });
});
