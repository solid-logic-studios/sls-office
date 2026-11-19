import { describe, expect, it } from 'vitest';
import type { DecorFn, PlaceArt, StageView, Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { SWEAT_COLOUR } from '../../src/engine/effects.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { Lab, oom, run } from '../support/lab.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

function character(engine: Engine, id: string) {
  const found = engine.characters().find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No character ${id}`);
  return found;
}

describe('Engine moods and poses', () => {
  it('types while working, frantically with sweat while stressed', () => {
    const lab = new Lab();
    lab.workload('scrd-server-develop').cpu = 95;
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    run(engine, 0.2);
    expect(character(engine, 'scrd-client-develop').pose).toBe('type');
    expect(character(engine, 'scrd-server-develop')).toMatchObject({
      mood: 'stressed',
      pose: 'type',
      status: 'STRESSED',
    });
    let sweat = false;
    run(engine, 5, () => {
      const painter = new RecordingPainter();
      engine.draw(painter);
      sweat = painter.rects.some((rect) => rect.colour === SWEAT_COLOUR);
      return sweat;
    });
    expect(sweat).toBe(true);
  });

  it('idles on a break, and wanders off to a break spot now and then', () => {
    const lab = new Lab();
    lab.workload('scrd-server-develop').cpu = 2;
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    run(engine, 0.2);
    expect(character(engine, 'scrd-server-develop')).toMatchObject({ mood: 'break', pose: 'idle', status: 'BREAK' });
    const spots = boxesTheme.layout.breakSpots.map((spot) => spot.x);
    const wandered = run(engine, 60, () => spots.includes(character(engine, 'scrd-server-develop').x));
    expect(wandered).toBe(true);
  });

  it('hides an absent character', () => {
    const lab = new Lab();
    lab.siteInstance('scrd-server-develop').health = 'down';
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    expect(character(engine, 'scrd-server-develop')).toMatchObject({ mood: 'absent', visible: false });
  });

  it('faints on an OOM kill, lies at its desk, and says the recovered cue on getting up', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    const speech: string[] = [];
    engine.bus.subscribe('speech', (event) => {
      if (event.speakerId === 'bsra-bsra-production') speech.push(event.text);
    });
    const logs: string[] = [];
    engine.bus.subscribe('log', (event) => logs.push(event.text));
    engine.accept(lab.snapshot());
    engine.accept(lab.snapshot([oom('bsra-bsra-production')]));
    const desk = boxesTheme.layout.homes.worker[6];
    expect(character(engine, 'bsra-bsra-production')).toMatchObject({
      mood: 'fainted',
      pose: 'faint',
      status: 'FAINTED',
      x: desk?.seat.x,
    });
    expect(logs).toContain('OOM kill: bsra-bsra-production fainted and is restarting');
    expect(engine.tipAt(desk?.seat.x ?? 0, 148)?.severity).toBe('warn');
    run(engine, 5);
    expect(character(engine, 'bsra-bsra-production')).toMatchObject({ mood: 'working', pose: 'type' });
    expect(speech).toContain('BACK');
  });
});

describe('Engine tooltips', () => {
  it('shows the character under the point, with its full id, blurb, load and status', () => {
    const lab = new Lab();
    lab.workload('forms-api-api-production').cpu = 85;
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    run(engine, 0.1);
    const worker = character(engine, 'forms-api-api-production');
    expect(engine.tipAt(worker.x, worker.y - 5)).toEqual({
      title: 'forms-api-api-production',
      detail: 'forms-api-api-production, site-instance',
      cpu: 85,
      mem: 40,
      status: 'STRESSED',
      severity: 'warn',
    });
  });

  it("shows a place's occupant even while it is away", () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    lab.vm('compute').up = false;
    engine.accept(lab.snapshot());
    const desk = boxesTheme.layout.homes.worker[0];
    if (desk === undefined) throw new Error('No desk');
    expect(engine.tipAt(desk.x + 1, desk.baseY - 1)).toMatchObject({
      title: 'scrd-server-develop',
      status: 'ABSENT',
      severity: 'crit',
    });
  });

  it("shows a founder's name and blurb, with no load", () => {
    const engine = new Engine(boxesTheme);
    engine.accept(new Lab().snapshot());
    const founder = character(engine, 'founder-a');
    expect(engine.tipAt(founder.x, founder.y - 3)).toEqual({
      title: 'Founder A',
      detail: 'A plain box standing in for a founder.',
      status: 'WORKING',
      severity: 'ok',
    });
  });

  it('falls back to a hotspot, then to the room', () => {
    const theme: Theme = {
      ...boxesTheme,
      hotspots: [
        {
          rect: { x: 200, y: 20, w: 10, h: 10 },
          tip: () => ({ title: 'Clock', detail: '', status: 'TICKING', severity: 'ok' }),
        },
      ],
    };
    const engine = new Engine(theme);
    engine.accept(new Lab().snapshot());
    expect(engine.tipAt(205, 25)?.title).toBe('Clock');
    const room = boxesTheme.layout.rooms.deploy;
    expect(engine.tipAt(room.x + 50, room.y + 5)).toEqual({
      title: 'sls-deploy',
      detail: room.blurb,
      cpu: 40,
      mem: 40,
      status: 'WORKING',
      severity: 'ok',
    });
    expect(engine.tipAt(419, 175)).toBeNull();
  });
});

describe('Engine drawing', () => {
  it('draws back decor first, then places and characters by base line, then front decor, then bubbles', () => {
    const marker =
      (text: string): DecorFn =>
      (painter) =>
        painter.text(text, 0, 0, '#000');
    const desk = boxesTheme.layout.homes.worker[0];
    if (desk === undefined) throw new Error('No desk');
    const art: PlaceArt = (painter) => painter.text('DESK', 0, 0, '#000');
    const theme: Theme = {
      ...boxesTheme,
      layout: { ...boxesTheme.layout, homes: { ...boxesTheme.layout.homes, worker: [{ ...desk, art }] } },
      decor: { back: [marker('BACK')], props: [{ baseY: 999, draw: marker('PROP') }], front: [marker('FRONT')] },
    };
    const engine = new Engine(theme);
    engine.accept(new Lab().snapshot());
    engine.bus.publish({ kind: 'speech', speakerId: 'scrd-server-develop', text: 'hello', force: true });
    const painter = new RecordingPainter();
    engine.draw(painter);
    const order = painter.texts.filter((text) => ['BACK', 'DESK', 'PROP', 'FRONT', 'HELLO'].includes(text));
    expect(order).toEqual(['BACK', 'DESK', 'PROP', 'FRONT', 'HELLO']);
    expect(painter.calls.at(-1)).toMatchObject({ op: 'text', text: 'HELLO' });
  });

  it('builds the stage view once per frame for the Theme', () => {
    const views: StageView[] = [];
    const theme: Theme = {
      ...boxesTheme,
      decor: { ...boxesTheme.decor, back: [(_painter, view) => views.push(view)] },
    };
    const lab = new Lab();
    const engine = new Engine(theme);
    engine.setHour(21.5);
    engine.accept(lab.snapshot());
    run(engine, 1);
    engine.draw(new RecordingPainter());
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      hour: 21.5,
      vaultOpen: false,
      liftInUse: false,
      lift: { doorsOpen: false, calls: new Set() },
      host: { name: 'sls-host' },
    });
    expect(views[0]?.now).toBeCloseTo(1);
    expect(views[0]?.vms).toHaveLength(4);
  });
});

describe('Engine setTheme', () => {
  it('rebuilds the cast from the last Snapshot under the new Theme', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme);
    engine.accept(lab.snapshot());
    const fewer: Theme = {
      ...boxesTheme,
      id: 'fewer',
      cast: (subject, generation) => (subject.kind === 'vm' ? null : boxesTheme.cast(subject, generation)),
      founders: [],
    };
    engine.setTheme(fewer);
    expect(engine.theme).toBe(fewer);
    const parts = new Set(engine.characters().map((character) => character.part));
    expect(parts).toEqual(new Set(['worker', 'greeter', 'guard', 'checker']));
    expect(engine.characters()).toHaveLength(16);
    engine.setTheme(boxesTheme);
    expect(engine.characters()).toHaveLength(21);
  });

  it('keeps going after a Theme change: the old stage no longer hears the bus', () => {
    const lab = new Lab();
    const engine = new Engine(boxesTheme, { random: seededRandom(7) });
    engine.accept(lab.snapshot());
    engine.setTheme({ ...boxesTheme, id: 'again' });
    const logs: string[] = [];
    engine.bus.subscribe('log', (event) => logs.push(event.text));
    lab.vm('ci').up = false;
    engine.accept(lab.snapshot());
    expect(logs).toEqual(['sls-ci went down']);
    run(engine, 1);
    expect(engine.characters().find((character) => character.part === 'wrangler')?.visible).toBe(false);
  });
});
