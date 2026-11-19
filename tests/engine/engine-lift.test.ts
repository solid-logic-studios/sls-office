import { describe, expect, it } from 'vitest';
import type { StageView, Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { EventBus } from '../../src/engine/event-bus.ts';
import { LIFT_SECONDS } from '../../src/engine/lift.ts';
import { Random, seededRandom } from '../../src/engine/random.ts';
import { Stage } from '../../src/engine/stage.ts';
import { officeTheme } from '../../src/themes/office/index.ts';
import { towerTheme } from '../../src/themes/tower/index.ts';
import { Lab, backup, deploy, run } from '../support/lab.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

const DT = 0.05;

/** A Stage under the Theme, stepped frame by frame the way the Engine steps it. */
function stageOf(theme: Theme) {
  const clock = { now: 0 };
  const bus = new EventBus();
  const stage = new Stage(theme, bus, new Random(seededRandom(0x51_0ff1ce)), clock);
  stage.reconcile(new Lab().snapshot(), false);
  const frame = (): void => {
    clock.now += DT;
    stage.update(DT);
  };
  return { stage, bus, frame };
}

/** The most a walk line can change in one frame at LIFT_SECONDS per floor. */
function perFrameTravel(theme: Theme): number {
  const lines = theme.layout.floors.map((floor) => floor.walkY);
  const gaps = lines.slice(1).map((line, i) => Math.abs(line - (lines[i] ?? line)));
  return (Math.max(...gaps) / LIFT_SECONDS) * DT;
}

describe('the shared lift on the Stage', () => {
  it('carries every rider in the car, which never jumps, across a standup run in the Tower', () => {
    const { stage, bus, frame } = stageOf(towerTheme);
    const standups: string[] = [];
    bus.subscribe('standup', (event) => standups.push(event.founderId));
    for (const founder of towerTheme.founders) expect(stage.callStandup(founder.id)).toBe(true);

    const travel = perFrameTravel(towerTheme);
    let last = stage.lift.y;
    let rideFrames = 0;
    let waitFrames = 0;
    let sharedFrames = 0;
    for (let t = 0; t < 90; t += DT) {
      frame();
      const y = stage.lift.y;
      expect(Math.abs(y - last)).toBeLessThanOrEqual(travel + 1e-9);
      last = y;
      const riders = stage.characters().filter((character) => character.visible && character.inLift);
      for (const rider of riders) expect(Math.abs(rider.y - (y - rider.lane))).toBeLessThanOrEqual(1);
      rideFrames += riders.length > 0 ? 1 : 0;
      sharedFrames += riders.length > 1 ? 1 : 0;
      waitFrames += stage.characters().some((character) => character.waitingForLift) ? 1 : 0;
      expect(stage.lift.inUse).toBe(
        riders.length > 0 || stage.characters().some((character) => character.waitingForLift || character.inLift),
      );
    }
    expect(standups.sort()).toEqual(towerTheme.founders.map((founder) => founder.id).sort());
    expect(rideFrames).toBeGreaterThan(0);
    expect(waitFrames).toBeGreaterThan(0);
    // Both founders head for the basement together, so at some point they share the car.
    expect(sharedFrames).toBeGreaterThan(0);
  });

  it('reports the car in the StageView, with the floors that are calling', () => {
    const views: StageView[] = [];
    const theme: Theme = {
      ...towerTheme,
      decor: { ...towerTheme.decor, back: [(_painter, view) => views.push(view)] },
    };
    const { stage, frame } = stageOf(theme);
    const founder = theme.founders[0];
    if (founder === undefined) throw new Error('No founder');
    stage.callStandup(founder.id);
    let called = false;
    let opened = false;
    for (let t = 0; t < 30 && !(called && opened); t += DT) {
      frame();
      stage.draw(new RecordingPainter(), 12);
      const view = views.at(-1);
      expect(view?.lift).toEqual({
        y: stage.lift.y,
        moving: stage.lift.moving,
        doorsOpen: stage.lift.doorsOpen,
        calls: stage.lift.calls,
      });
      expect(view?.liftInUse).toBe(stage.lift.inUse);
      called ||= (view?.lift.calls.size ?? 0) > 0;
      opened ||= view?.lift.doorsOpen === true;
    }
    expect(called).toBe(true);
    expect(opened).toBe(true);
  });

  it('drops a waiting character from the lift calls in the same frame it vanishes', () => {
    const { stage, frame } = stageOf(towerTheme);
    const founder = towerTheme.founders[0];
    if (founder === undefined) throw new Error('No founder');
    stage.callStandup(founder.id);
    for (let t = 0; t < 30 && stage.lift.calls.size === 0; t += DT) frame();
    const waiter = stage.characters().find((character) => character.waitingForLift);
    if (waiter === undefined) throw new Error('Nobody waited for the lift');
    const others = stage.characters().filter((character) => character !== waiter && character.waitingForLift);
    expect(stage.lift.calls.has(waiter.floor)).toBe(true);
    waiter.vanish();
    expect(waiter.waitingForLift).toBe(false);
    expect(stage.lift.calls).toEqual(new Set(others.map((character) => character.floor)));
  });
});

/** A rig for one Theme: an Engine on a fresh Lab, with speech recorded. */
function engineOf(theme: Theme) {
  const lab = new Lab();
  const views: StageView[] = [];
  const watched: Theme = { ...theme, decor: { ...theme.decor, back: [(_painter, view) => views.push(view)] } };
  const engine = new Engine(watched);
  engine.accept(lab.snapshot());
  const find = (id: string) => engine.characters().find((character) => character.id === id);
  /** Draws a frame and returns its StageView. */
  const look = (): StageView | undefined => {
    engine.draw(new RecordingPainter());
    return views.at(-1);
  };
  return { lab, engine, find, look };
}

/** Seconds of animation until `done`, up to `limit`; `Infinity` if it never holds. */
function timeUntil(engine: Engine, limit: number, done: () => boolean): number {
  for (let t = 0; t < limit; t += DT) {
    if (done()) return t;
    engine.update(DT);
  }
  return Number.POSITIVE_INFINITY;
}

const TARGET = 'scrd-server-develop';
const SCENE_BOUND_SECONDS = 60;

describe.each([
  ['Tower', towerTheme],
  ['Office', officeTheme],
])('scenes in the %s still complete with the shared lift', (_name, theme) => {
  const keeperHome = theme.layout.homes.keeper[0];
  const courierHome = theme.layout.homes.courier[0];

  it(`plays a standup to the end within ${SCENE_BOUND_SECONDS} s`, () => {
    const { engine } = engineOf(theme);
    const founder = theme.founders[0];
    if (founder === undefined) throw new Error('No founder');
    const standups: string[] = [];
    engine.bus.subscribe('standup', (event) => standups.push(event.founderId));
    expect(engine.callStandup(founder.id)).toBe(true);
    const arrived = timeUntil(engine, SCENE_BOUND_SECONDS, () => standups.length > 0);
    expect(arrived).toBeLessThan(SCENE_BOUND_SECONDS);
    // Once it has held the floor it can be called again: the Standup is over.
    expect(run(engine, SCENE_BOUND_SECONDS, () => engine.callStandup(founder.id))).toBe(true);
  });

  it(`plays a healthy deploy to the end within ${SCENE_BOUND_SECONDS} s`, () => {
    const { lab, engine, find } = engineOf(theme);
    engine.accept(lab.snapshot([deploy('started', TARGET)]));
    engine.accept(lab.snapshot([deploy('healthy', TARGET)]));
    const done = timeUntil(
      engine,
      SCENE_BOUND_SECONDS,
      () =>
        find(TARGET) === undefined &&
        find(`${TARGET}#1`)?.status === theme.lines.status.working &&
        find('sls-deploy')?.x === courierHome?.seat.x,
    );
    expect(done).toBeLessThan(SCENE_BOUND_SECONDS);
  });

  it(`plays a vault run to the end within ${SCENE_BOUND_SECONDS} s`, () => {
    const { lab, engine, find, look } = engineOf(theme);
    engine.accept(lab.snapshot([backup('finished')]));
    const opened = timeUntil(engine, SCENE_BOUND_SECONDS, () => look()?.vaultOpen === true);
    expect(opened).toBeLessThan(SCENE_BOUND_SECONDS);
    const done = timeUntil(
      engine,
      SCENE_BOUND_SECONDS,
      () => look()?.vaultOpen === false && find('sls-data')?.x === keeperHome?.seat.x,
    );
    expect(opened + done).toBeLessThan(SCENE_BOUND_SECONDS);
  });
});
