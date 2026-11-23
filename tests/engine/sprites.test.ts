import { describe, expect, it } from 'vitest';
import type { Headgear, HairStyle, HeldItem, Look, PersonLook } from '../../src/contract/theme.ts';
import { boundsOf, drawLook, type Pose, type SpriteState } from '../../src/engine/sprites.ts';
import { RecordingPainter } from '../support/recording-painter.ts';

const POSES: readonly Pose[] = ['stand', 'walk', 'type', 'idle', 'faint'];
const STYLES: readonly HairStyle[] = ['short', 'long', 'bun', 'spiky', 'bald', 'thin', 'cap', 'hardhat'];

const PERSON: Look = {
  kind: 'person',
  skin: '#f2c9a0',
  hair: '#2a1d14',
  hairStyle: 'short',
  shirt: '#4a90d9',
  pants: '#3a3f55',
  tie: '#e0563f',
  trim: '#f4f1e6',
  vest: '#f2c230',
  glasses: true,
  headset: true,
  wide: true,
  carry: 'clipboard',
};
const BOX: Look = { kind: 'box', colour: '#4a90d9', w: 8, h: 14 };

function state(pose: Pose, overrides: Partial<SpriteState> = {}): SpriteState {
  return {
    x: 50,
    y: 100,
    pose,
    facing: 1,
    time: 1.3,
    frantic: false,
    talking: false,
    seated: false,
    inLift: false,
    trolley: null,
    ...overrides,
  };
}

function draw(look: Look, sprite: SpriteState): RecordingPainter {
  const painter = new RecordingPainter();
  drawLook(painter, look, sprite);
  return painter;
}

describe('Sprite renderer', () => {
  it.each(POSES)('draws a person standing on its feet when %s', (pose) => {
    const painter = draw(PERSON, state(pose));
    expect(painter.rects.length).toBeGreaterThan(5);
    expect(painter.rects.every((rect) => rect.y <= 100)).toBe(true);
  });

  it.each(POSES)('draws a box in its colour when %s', (pose) => {
    const painter = draw(BOX, state(pose));
    expect(painter.rects.some((rect) => rect.colour === '#4a90d9')).toBe(true);
  });

  it('lays a fainted box flat', () => {
    const [body] = draw(BOX, state('faint')).rects;
    expect(body).toMatchObject({ w: 14, h: 8 });
  });

  it('shows a box walking and typing, so a box stage still reads', () => {
    const still = draw(BOX, state('stand')).rects.length;
    expect(draw(BOX, state('walk')).rects.length).toBeGreaterThan(still);
    expect(draw(BOX, state('type')).rects.length).toBeGreaterThan(still);
  });

  it.each(STYLES)('draws %s hair', (hairStyle) => {
    const look: Look = { ...PERSON, hairStyle, cap: '#f38020' };
    expect(draw(look, state('stand')).rects.length).toBeGreaterThan(5);
  });

  it('wheels a trolley in front, and draws the lift floor while riding', () => {
    const plain = draw(PERSON, state('walk')).rects.length;
    expect(draw(PERSON, state('walk', { trolley: 'parcel' })).rects.length).toBeGreaterThan(plain);
    expect(draw(BOX, state('walk', { trolley: 'strongbox' })).rects.length).toBeGreaterThan(
      draw(BOX, state('walk')).rects.length,
    );
    expect(draw(PERSON, state('stand', { inLift: true })).rects[0]).toMatchObject({ w: 16, h: 2 });
  });

  it('gives each look a hover box', () => {
    expect(boundsOf(PERSON)).toEqual({ half: 8, height: 24 });
    expect(boundsOf(BOX)).toEqual({ half: 5, height: 16 });
  });

  describe('costume pieces', () => {
    const PLAIN: PersonLook = {
      kind: 'person',
      skin: '#f2c9a0',
      hair: '#2a1d14',
      hairStyle: 'short',
      shirt: '#4a90d9',
      pants: '#3a3f55',
    };
    const INK = '#1d1a26';
    const MOUTH = '#7a2f2f';
    const CAPE = '#b8242c';
    const HEADGEAR: readonly Headgear[] = [
      { kind: 'helmet', shell: '#aa0001', face: '#aa0002', eyes: '#aa0003' },
      { kind: 'mask', colour: '#aa0001', eyes: '#aa0003' },
      { kind: 'cowl', colour: '#aa0001', mark: '#aa0002' },
    ];
    const HELD: readonly HeldItem[] = [
      { item: 'shield', rim: '#bb0001', band: '#bb0002', boss: '#bb0003' },
      { item: 'hammer', head: '#bb0001', haft: '#bb0002' },
      { item: 'bow', limbs: '#bb0001', quiver: '#bb0002' },
    ];
    const DRESSED: PersonLook = {
      ...PLAIN,
      wide: true,
      cape: CAPE,
      sleeves: '#cc0001',
      gloves: '#cc0002',
      boots: '#cc0003',
      eyepatch: true,
      emblem: { pixels: [[], [null, '#dd0001'], ['#dd0001', '#dd0001']], glow: '#dd0002' },
    };
    const colours = (look: Look, sprite: SpriteState): string[] => draw(look, sprite).rects.map((rect) => rect.colour);

    it('leaves a look with no costume exactly as it was', () => {
      const bare = draw(PLAIN, state('walk')).rects;
      const dressed = draw({ ...PLAIN, boots: '#cc0003', cape: CAPE }, state('walk')).rects;
      expect(dressed.filter((rect) => rect.colour !== '#cc0003' && rect.colour !== CAPE)).toEqual(bare);
    });

    it.each(POSES)('keeps every piece inside the hover box when %s', (pose) => {
      const { half, height } = boundsOf(DRESSED);
      // A held item on a broad build pokes two pixels past the hover box (the clipboard pokes one).
      // A fainted person lies down, wider still, with stars circling the head.
      const reach = pose === 'faint' ? 14 : half + 2;
      for (const facing of [1, -1] as const) {
        for (const headgear of [undefined, ...HEADGEAR]) {
          for (const carry of [undefined, ...HELD]) {
            for (const time of [1.03, 1.25, 1.3]) {
              const { rects } = draw({ ...DRESSED, headgear, carry }, state(pose, { facing, time }));
              for (const rect of rects) {
                expect(rect.x).toBeGreaterThanOrEqual(50 - reach);
                expect(rect.x + rect.w).toBeLessThanOrEqual(50 + reach);
                expect(rect.y).toBeGreaterThanOrEqual(100 - height);
                expect(rect.y + rect.h).toBeLessThanOrEqual(100);
              }
            }
          }
        }
      }
    });

    it('draws the cape first, behind the body, and trails it behind a walker', () => {
      const still = draw(DRESSED, state('stand')).rects;
      expect(still[0]?.colour).toBe(CAPE);
      const fall = (facing: 1 | -1): number | undefined =>
        draw(DRESSED, state('walk', { facing, time: 1.03 })).rects.filter((rect) => rect.colour === CAPE)[1]?.x;
      expect(fall(1)).toBe((still[1]?.x ?? 0) - 1);
      expect(fall(-1)).toBe((still[1]?.x ?? 0) + 1);
    });

    it('colours the arms, hands and boots', () => {
      for (const pose of ['stand', 'walk', 'type'] as const) {
        const used = colours(DRESSED, state(pose));
        expect(used.filter((colour) => colour === '#cc0001')).toHaveLength(2);
        expect(used.filter((colour) => colour === '#cc0002')).toHaveLength(2);
        expect(used.filter((colour) => colour === '#cc0003')).toHaveLength(2);
      }
    });

    it('draws only the lit pixels of an emblem, over its halo', () => {
      const used = colours(DRESSED, state('stand'));
      expect(used.filter((colour) => colour === '#dd0001')).toHaveLength(3);
      expect(used.indexOf('#dd0002')).toBeLessThan(used.indexOf('#dd0001'));
      expect(colours({ ...DRESSED, emblem: { pixels: [['#dd0001']] } }, state('stand'))).not.toContain('#dd0002');
    });

    it.each(HEADGEAR)('wears a $kind in place of the hair', (headgear) => {
      for (const pose of POSES) {
        const used = colours({ ...PLAIN, headgear }, state(pose));
        expect(used).toContain('#aa0001');
        expect(used).not.toContain(PLAIN.hair);
      }
    });

    it('hides the eyes and mouth behind a helmet or a mask, and keeps them under a cowl', () => {
      const talking = state('stand', { talking: true, time: 1.2 });
      const [helmet, mask, cowl] = HEADGEAR;
      for (const headgear of [helmet, mask]) {
        const used = colours({ ...PLAIN, headgear }, talking);
        expect(used).toContain('#aa0003');
        expect(used).not.toContain(MOUTH);
        expect(used.filter((colour) => colour === INK)).toHaveLength(2);
      }
      const used = colours({ ...PLAIN, headgear: cowl }, talking);
      expect(used).toContain(MOUTH);
      expect(used.filter((colour) => colour === INK)).toHaveLength(4);
    });

    it('puts a patch over one eye', () => {
      const bare = colours(PLAIN, state('stand')).filter((colour) => colour === INK).length;
      const patched = colours({ ...PLAIN, eyepatch: true }, state('stand')).filter((colour) => colour === INK).length;
      expect(patched).toBeGreaterThan(bare);
    });

    it.each(HELD)('holds a $item, and puts it away to push a trolley', (carry) => {
      const look: PersonLook = { ...PLAIN, carry };
      for (const pose of ['stand', 'walk', 'type', 'idle'] as const) {
        expect(colours(look, state(pose))).toContain('#bb0001');
      }
      expect(colours(look, state('walk', { trolley: 'parcel' }))).not.toContain('#bb0001');
      expect(colours(look, state('faint'))).not.toContain('#bb0001');
    });

    it('swings a held item with the arm', () => {
      const look: PersonLook = { ...PLAIN, carry: { item: 'hammer', head: '#bb0001', haft: '#bb0002' } };
      const headY = (sprite: SpriteState): number =>
        draw(look, sprite).rects.find((rect) => rect.colour === '#bb0001')?.y ?? Number.NaN;
      // At 1.15 s the walk is on the step that lowers the right arm a pixel, with no bob.
      expect(headY(state('walk', { time: 1.15 }))).toBe(headY(state('stand')) + 1);
    });
  });
});
