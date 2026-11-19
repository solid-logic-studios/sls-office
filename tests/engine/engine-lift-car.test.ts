import { describe, expect, it } from 'vitest';
import type { StageView, Theme } from '../../src/contract/theme.ts';
import { Engine } from '../../src/engine/engine.ts';
import { towerTheme } from '../../src/themes/tower/index.ts';
import { Lab } from '../support/lab.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

/** The Tower, with every frame's StageView recorded. */
function open(): { engine: Engine; views: StageView[] } {
  const views: StageView[] = [];
  const theme: Theme = { ...towerTheme, decor: { ...towerTheme.decor, back: [(_painter, view) => views.push(view)] } };
  const engine = new Engine(theme);
  engine.accept(new Lab().snapshot());
  return { engine, views };
}

function frame(engine: Engine): void {
  engine.update(0.05);
  engine.draw(new RecordingPainter());
}

describe('the lift car on the Stage', () => {
  it('is nowhere before the first ride', () => {
    const { engine, views } = open();
    frame(engine);
    expect(views.at(-1)?.liftCarY).toBeNull();
  });

  it('follows its rider between the walk lines, then stays at the destination', () => {
    const { engine, views } = open();
    expect(engine.callStandup('paul')).toBe(true);

    // Whoever rides first (the founder, or a character on an errand of its own).
    const carried: number[] = [];
    for (let t = 0; t < 40; t += 0.05) {
      frame(engine);
      const view = views.at(-1);
      if (view?.liftInUse === true && view.liftCarY !== null) carried.push(view.liftCarY);
      if (view?.liftInUse === false && carried.length > 0) break;
    }
    expect(carried.length).toBeGreaterThan(10);
    const first = carried[0] ?? Number.NaN;
    const last = carried.at(-1) ?? Number.NaN;
    expect(first).not.toBe(last);
    const direction = Math.sign(last - first);
    for (let i = 1; i < carried.length; i++) {
      expect(Math.sign((carried[i] ?? 0) - (carried[i - 1] ?? 0))).toBe(direction);
    }

    // The frame the ride ends on already shows a destination walk line, and the car stays there.
    const parked = views.at(-1)?.liftCarY ?? null;
    expect(parked).not.toBeNull();
    expect(towerTheme.layout.floors.map((floor) => floor.walkY)).toContain(parked);
    for (let i = 0; i < 5; i++) {
      frame(engine);
      if (views.at(-1)?.liftInUse === true) break;
      expect(views.at(-1)?.liftCarY).toBe(parked);
    }
  });
});
