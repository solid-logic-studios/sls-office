import { describe, expect, it } from 'vitest';
import type { HairStyle, Look } from '../../src/contract/theme.ts';
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
});
