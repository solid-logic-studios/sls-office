import { describe, expect, it } from 'vitest';
import { boundsOf, type Pose } from '../../src/engine/sprites.ts';
import { HEROES, POSTS, RESERVES, ROOKIES, SQUADS } from '../../src/themes/hq/avengers.ts';
import { ALARM } from '../../src/themes/hq/palette.ts';
import { drawSprite, spriteState } from '../support/sprite.ts';

const POSES: readonly Pose[] = ['stand', 'walk', 'type', 'idle'];
const TORSO = { w: 8, h: 7 };

describe('The Avengers cast', () => {
  it('names every hero once', () => {
    const names = HEROES.map((hero) => hero.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('puts every post, rookie, squad member and reserve on the look sheet', () => {
    const cast = [
      POSTS.greeter,
      ...POSTS.guards,
      POSTS.checker,
      POSTS.courier,
      POSTS.keeper,
      POSTS.wrangler,
      ...ROOKIES,
      ...Object.values(SQUADS).flat(),
      ...RESERVES,
    ];
    for (const hero of cast) expect(HEROES).toContain(hero);
  });

  it('gives no hero two jobs', () => {
    const watch = [...Object.values(SQUADS).flat(), ...RESERVES];
    expect(new Set(watch).size).toBe(watch.length);
    const posts = [POSTS.greeter, ...POSTS.guards, POSTS.checker, POSTS.courier, POSTS.keeper, POSTS.wrangler];
    for (const hero of [...posts, ...ROOKIES]) expect(watch).not.toContain(hero);
  });

  it.each(HEROES)("fits $name's emblem on the torso", ({ look }) => {
    const rows = look.emblem?.pixels ?? [];
    expect(rows.length).toBeLessThanOrEqual(TORSO.h);
    for (const row of rows) expect(row.length).toBeLessThanOrEqual(TORSO.w);
  });

  it.each(HEROES)('draws $name within two pixels of the hover box, standing on the floor', ({ look }) => {
    const { half, height } = boundsOf(look);
    for (const pose of POSES) {
      for (const time of [1.03, 1.15, 1.25, 1.3]) {
        const painter = drawSprite(look, spriteState(pose, { time, talking: true, seated: pose === 'idle' }));
        for (const rect of painter.rects) {
          expect(rect.x).toBeGreaterThanOrEqual(50 - half - 2);
          expect(rect.x + rect.w).toBeLessThanOrEqual(50 + half + 2);
          expect(rect.y).toBeGreaterThanOrEqual(100 - height);
          expect(rect.y + rect.h).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('keeps the alarm red for the alarm', () => {
    const reds: readonly string[] = Object.values(ALARM);
    for (const { look } of HEROES) {
      const colours = [look.shirt, look.pants, look.cape, look.sleeves, look.gloves, look.boots];
      for (const colour of colours) expect(reds).not.toContain(colour);
    }
  });
});
