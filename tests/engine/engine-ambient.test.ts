import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.ts';
import { CROSS_COLOUR, PAPER_COLOUR, TICK_COLOUR } from '../../src/engine/effects.ts';
import type { EngineEvent } from '../../src/engine/events.ts';
import { seededRandom } from '../../src/engine/random.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { Lab, SITE_IDS, record, run, said } from '../support/lab.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

const CHECKER = 'gatus';
const KEEPER = 'sls-data';

function setUp(lab = new Lab(), seed = 1) {
  const engine = new Engine(boxesTheme, { random: seededRandom(seed) });
  const events = record(engine.bus);
  engine.accept(lab.snapshot());
  const find = (id: string) => engine.characters().find((character) => character.id === id);
  return { lab, engine, events, find };
}

function colours(engine: Engine): Set<string> {
  const painter = new RecordingPainter();
  engine.draw(painter);
  return new Set(painter.rects.map((rect) => rect.colour));
}

describe('Checker rounds', () => {
  it('visits each occupied desk in order, marking the well with a tick and the absent with a cross', () => {
    const lab = new Lab();
    lab.siteInstance(SITE_IDS[2] ?? '').health = 'down';
    const { engine, find } = setUp(lab);
    const stops: number[] = [];
    let ticks = false;
    let crosses = false;
    run(engine, 30, () => {
      const checker = find(CHECKER);
      if (checker !== undefined && checker.pose === 'stand' && stops.at(-1) !== checker.x) stops.push(checker.x);
      const seen = colours(engine);
      ticks ||= seen.has(TICK_COLOUR);
      crosses ||= seen.has(CROSS_COLOUR);
      return false;
    });
    const desks = boxesTheme.layout.homes.worker.map((place) => place.seat.x - 6);
    expect(stops.filter((x) => desks.includes(x))).toEqual(desks);
    expect(ticks).toBe(true);
    expect(crosses).toBe(true);
  });

  it('waits at home between rounds', () => {
    const { engine, find } = setUp();
    const home = boxesTheme.layout.homes.checker[0]?.seat.x;
    expect(run(engine, 30, () => find(CHECKER)?.x === home && find(CHECKER)?.pose === 'stand')).toBe(true);
    run(engine, 3);
    expect(find(CHECKER)?.x).toBe(home);
  });
});

describe('Founders', () => {
  it('check in on a seated worker, who answers', () => {
    const { engine, events } = setUp();
    const checkIn = (event: EngineEvent) => event.kind === 'speech' && event.text === 'HOW GOES IT?';
    expect(run(engine, 300, () => events.some(checkIn))).toBe(true);
    const asked = events.findIndex(checkIn);
    run(engine, 2);
    const reply = events
      .slice(asked)
      .find((event) => event.kind === 'speech' && (event.text === 'FINE' || event.text === 'BUSY'));
    expect(reply).toBeDefined();
    expect(SITE_IDS).toContain(reply?.kind === 'speech' ? reply.speakerId : '');
  });

  it('say an alarm line while there is a critical finding', () => {
    const lab = new Lab();
    lab.findings = { ok: 1, warn: 0, crit: 2 };
    const { engine, events } = setUp(lab);
    expect(
      run(
        engine,
        600,
        () => said(events, 'founder-a').includes('ALARM!') || said(events, 'founder-a').includes('ALL HANDS'),
      ),
    ).toBe(true);
    expect(said(events, 'founder-a')).not.toContain('HMM');
  });
});

describe('Ambient traffic', () => {
  it('sends a visitor to a worker, who is told so on the bus, then lets it go', () => {
    const lab = new Lab();
    lab.vm('compute').cpu = 90;
    const { engine, events } = setUp(lab);
    expect(run(engine, 60, () => events.some((event) => event.kind === 'visitor'))).toBe(true);
    const visit = events.find((event) => event.kind === 'visitor');
    expect(SITE_IDS).toContain(visit?.kind === 'visitor' ? visit.targetId : '');
    // Visitors play no part, so they are not in the character list.
    expect(engine.characters().some((character) => character.id.startsWith('visitor'))).toBe(false);
  });

  it("finds a visitor's tooltip on the stage", () => {
    const lab = new Lab();
    lab.vm('compute').cpu = 90;
    const { engine, events } = setUp(lab);
    run(engine, 60, () => events.some((event) => event.kind === 'visitor'));
    const visit = events.find((event) => event.kind === 'visitor');
    const target = engine
      .characters()
      .find((character) => visit?.kind === 'visitor' && character.id === visit.targetId);
    if (target === undefined) throw new Error('No visited worker');
    expect(engine.tipAt(target.x - 7, target.y - 4)).toMatchObject({ title: 'Visitor', status: 'VISITING' });
  });

  it('flies a query paper to the keeper and back to the same worker', () => {
    const lab = new Lab();
    lab.vm('compute').cpu = 90;
    const { engine, events } = setUp(lab);
    const papers = () => events.filter((event) => event.kind === 'paper');
    expect(run(engine, 60, () => papers().length >= 2)).toBe(true);
    const [out, back] = papers();
    expect(out).toMatchObject({ toId: KEEPER });
    expect(back).toMatchObject({ fromId: KEEPER, toId: out?.kind === 'paper' ? out.fromId : '' });
  });

  it('draws the paper in flight', () => {
    const lab = new Lab();
    lab.vm('compute').cpu = 90;
    const { engine, events } = setUp(lab);
    run(engine, 60, () => events.some((event) => event.kind === 'paper'));
    run(engine, 0.3);
    expect(colours(engine).has(PAPER_COLOUR)).toBe(true);
  });

  it('sends nothing while the compute VM is down', () => {
    const lab = new Lab();
    lab.vm('compute').cpu = 90;
    const { engine, events } = setUp(lab);
    lab.vm('compute').up = false;
    engine.accept(lab.snapshot());
    run(engine, 30);
    expect(events.some((event) => event.kind === 'visitor' || event.kind === 'paper')).toBe(false);
  });
});
