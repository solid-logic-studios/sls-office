import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine.ts';
import type { EngineEvent } from '../../src/engine/events.ts';
import { CHECKER_OFFSET, COURIER_OFFSET } from '../../src/engine/scenes/deploy.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { Lab, deploy, logged, record, run, said } from '../support/lab.ts';

const TARGET = 'scrd-server-develop';
const NEWCOMER = `${TARGET}#1`;
const COURIER = 'sls-deploy';
const CHECKER = 'gatus';
const DESK = boxesTheme.layout.homes.worker[0];
const COURIER_POST = boxesTheme.layout.homes.courier[0];

interface Rig {
  lab: Lab;
  engine: Engine;
  events: EngineEvent[];
  find: (id: string) => ReturnType<Engine['characters']>[number] | undefined;
}

function rig(): Rig {
  const lab = new Lab();
  const engine = new Engine(boxesTheme);
  const events = record(engine.bus);
  engine.accept(lab.snapshot());
  const find = (id: string) => engine.characters().find((character) => character.id === id);
  return { lab, engine, events, find };
}

describe('Deploy scene', () => {
  it('plays a healthy deploy: delivery, newcomer, health check, handover, and the old one leaves', () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    expect(said(events, COURIER)).toEqual(['DELIVERY']);
    expect(find(COURIER)?.status).toBe('DELIVERING');
    expect(logged(events)).toContain(`Deploy started: ${TARGET}`);

    expect(run(engine, 15, () => find(NEWCOMER) !== undefined)).toBe(true);
    expect(find(NEWCOMER)).toMatchObject({ part: 'worker', status: 'NEW', visible: true });
    expect(said(events, NEWCOMER)).toEqual(['NEW BOX']);
    expect(find(COURIER)?.x).toBe((DESK?.seat.x ?? 0) + COURIER_OFFSET);

    // The checker walks over and runs the health check; with no verdict yet it waits.
    const checking = () =>
      said(events, CHECKER).includes('CHECKING') && find(CHECKER)?.x === (DESK?.seat.x ?? 0) + CHECKER_OFFSET;
    expect(run(engine, 15, checking)).toBe(true);
    run(engine, 5);
    expect(said(events, CHECKER)).not.toContain('HEALTHY');

    engine.accept(lab.snapshot([deploy('healthy', TARGET)]));
    expect(run(engine, 3, () => said(events, CHECKER).includes('HEALTHY'))).toBe(true);
    expect(said(events, TARGET)).toContain('OUT');
    expect(find(TARGET)?.status).toBe('LEAVING');

    run(engine, 15);
    expect(find(TARGET)).toBeUndefined();
    expect(find(NEWCOMER)).toMatchObject({ x: DESK?.seat.x, status: 'WORKING', pose: 'type' });
    expect(find(COURIER)).toMatchObject({ x: COURIER_POST?.seat.x, status: 'WORKING' });
    expect(logged(events)).toContain(`Deploy healthy: ${TARGET} is on the new container`);
    // The newcomer is the worker for the workload now: its tooltip leads with the full id.
    const desk = DESK;
    if (desk === undefined) throw new Error('No desk');
    expect(engine.tipAt(desk.x + 1, desk.baseY - 1)?.title).toBe(TARGET);
  });

  it('plays a rolled-back deploy: the newcomer is sent home and the old one keeps serving', () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    run(engine, 15, () => said(events, CHECKER).includes('CHECKING'));
    engine.accept(lab.snapshot([deploy('rolled-back', TARGET)]));
    expect(run(engine, 6, () => said(events, TARGET).includes('SERVING'))).toBe(true);
    expect(said(events, CHECKER)).toContain('UNHEALTHY');
    expect(said(events, NEWCOMER)).toEqual(['NEW BOX', 'HOME']);
    run(engine, 15);
    expect(find(NEWCOMER)).toBeUndefined();
    expect(find(TARGET)).toMatchObject({ x: DESK?.seat.x, status: 'WORKING' });
  });

  it('keeps a verdict that arrives before the courier does', () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    engine.accept(lab.snapshot([deploy('healthy', TARGET)]));
    expect(find(NEWCOMER)).toBeUndefined();
    expect(run(engine, 30, () => said(events, CHECKER).includes('HEALTHY'))).toBe(true);
    run(engine, 15);
    expect(find(TARGET)).toBeUndefined();
    expect(find(NEWCOMER)?.x).toBe(DESK?.seat.x);
  });

  it('gives the verdict to the latest deploy of a subject, not an older one whose verdict was lost', () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    engine.accept(lab.snapshot([deploy('healthy', TARGET)]));
    // The first scene has no verdict and gives up after 30 s; the second then plays with its verdict known.
    expect(run(engine, 60, () => said(events, CHECKER).includes('HEALTHY'))).toBe(true);
    run(engine, 15);
    expect(find(TARGET)).toBeUndefined();
    expect(find(`${TARGET}#2`)).toMatchObject({ x: DESK?.seat.x, status: 'WORKING' });
    expect(said(events, COURIER)).toEqual(['DELIVERY', 'DELIVERY']);
  });

  it('plays the whole deploy for a verdict whose start was missed', () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('rolled-back', TARGET)]));
    expect(said(events, COURIER)).toEqual(['DELIVERY']);
    expect(run(engine, 30, () => said(events, TARGET).includes('SERVING'))).toBe(true);
    run(engine, 15);
    expect(find(NEWCOMER)).toBeUndefined();
    expect(find(TARGET)?.visible).toBe(true);
  });

  it('queues a second deploy behind the first, as the courier is busy', () => {
    const { lab, engine, events, find } = rig();
    const second = 'lab-test-api-develop';
    engine.accept(lab.snapshot([deploy('started', TARGET), deploy('started', second)]));
    expect(said(events, COURIER)).toEqual(['DELIVERY']);
    engine.accept(lab.snapshot([deploy('healthy', TARGET), deploy('healthy', second)]));
    expect(run(engine, 40, () => find(`${second}#1`) !== undefined)).toBe(true);
    // The first had handed over before the second newcomer came in.
    expect(find(TARGET)).toBeUndefined();
    expect(find(NEWCOMER)?.status).toBe('WORKING');
    expect(said(events, COURIER)).toEqual(['DELIVERY', 'DELIVERY']);
    run(engine, 40);
    expect(find(second)).toBeUndefined();
    expect(find(`${second}#1`)?.status).toBe('WORKING');
  });

  it("abandons a deploy when the courier's VM goes down, and removes the newcomer", () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    run(engine, 15, () => find(NEWCOMER) !== undefined);
    lab.vm('deploy').up = false;
    engine.accept(lab.snapshot());
    run(engine, 0.5);
    expect(find(NEWCOMER)).toBeUndefined();
    expect(logged(events)).toContain(`Deploy of ${TARGET} abandoned: a VM went down mid-deploy`);
    expect(find(TARGET)).toMatchObject({ visible: true, status: 'WORKING' });

    // A late verdict for the abandoned deploy does not replay it.
    lab.vm('deploy').up = true;
    engine.accept(lab.snapshot([deploy('rolled-back', TARGET)]));
    run(engine, 1);
    expect(find(COURIER)).toMatchObject({ visible: true, x: COURIER_POST?.seat.x, status: 'WORKING' });
    expect(said(events, COURIER)).toEqual(['DELIVERY']);
  });

  it("abandons a deploy when the target's VM goes down", () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    run(engine, 4);
    lab.vm('compute').up = false;
    engine.accept(lab.snapshot());
    run(engine, 0.5);
    expect(logged(events)).toContain(`Deploy of ${TARGET} abandoned: a VM went down mid-deploy`);
    run(engine, 15);
    expect(find(COURIER)).toMatchObject({ x: COURIER_POST?.seat.x, status: 'WORKING' });
  });

  it('gives up after 30 s with no verdict: the newcomer vanishes and nobody changes desks', () => {
    const { lab, engine, events, find } = rig();
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    run(engine, 15, () => find(NEWCOMER) !== undefined);
    // The checker takes about 8 s to walk over; the 30 s start once it has said its line.
    run(engine, 36);
    expect(find(NEWCOMER)).toBeDefined();
    run(engine, 3);
    expect(find(NEWCOMER)).toBeUndefined();
    expect(said(events, CHECKER)).not.toContain('HEALTHY');
    expect(find(TARGET)?.x).toBe(DESK?.seat.x);
    run(engine, 15);
    expect(find(COURIER)?.x).toBe(COURIER_POST?.seat.x);
  });
});
