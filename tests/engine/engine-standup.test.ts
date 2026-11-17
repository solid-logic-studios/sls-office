import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { Engine, type CharacterView } from '../../src/engine/engine.ts';
import { STANDUP_SECONDS } from '../../src/engine/characters/founder.ts';
import { boxesTheme } from '../../src/themes/boxes/index.ts';
import { Lab, run } from '../support/lab.ts';

function founder(engine: Engine, id: string): CharacterView {
  const found = engine.characters().find((character) => character.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
}

function open(theme: Theme = boxesTheme): { engine: Engine; standups: string[] } {
  const engine = new Engine(theme);
  engine.accept(new Lab().snapshot());
  const standups: string[] = [];
  engine.bus.subscribe('standup', (event) => standups.push(event.founderId));
  return { engine, standups };
}

const FRONT = (boxesTheme.layout.floors[0]?.minX ?? 0) / 2 + (boxesTheme.layout.floors[0]?.maxX ?? 0) / 2;

describe('Engine.callStandup', () => {
  it('walks the founder to the front, publishes standup once on arrival, then sends it home', () => {
    const { engine, standups } = open();
    const home = founder(engine, 'founder-a').x;
    expect(engine.callStandup('founder-a')).toBe(true);
    expect(standups).toEqual([]);
    expect(run(engine, 30, () => standups.length > 0)).toBe(true);
    expect(standups).toEqual(['founder-a']);
    expect(founder(engine, 'founder-a').x).toBeCloseTo(FRONT, 0);
    expect(founder(engine, 'founder-a').floor).toBe(0);
    expect(founder(engine, 'founder-a').pose).toBe('stand');

    run(engine, STANDUP_SECONDS - 2);
    expect(founder(engine, 'founder-a').x).toBeCloseTo(FRONT, 0);
    // Once released it heads home like after any errand (it may then take up another, so stop at the first arrival).
    expect(run(engine, 15, () => Math.abs(founder(engine, 'founder-a').x - home) < 1)).toBe(true);
    expect(standups).toEqual(['founder-a']);
  });

  it('refuses a second call while one is under way, and an unknown id', () => {
    const { engine } = open();
    expect(engine.callStandup('nobody')).toBe(false);
    expect(engine.callStandup('founder-a')).toBe(true);
    expect(engine.callStandup('founder-a')).toBe(false);
  });

  it('does nothing for a Theme without founders', () => {
    const { engine, standups } = open({ ...boxesTheme, founders: [] });
    expect(engine.callStandup('founder-a')).toBe(false);
    run(engine, 30);
    expect(standups).toEqual([]);
  });
});
