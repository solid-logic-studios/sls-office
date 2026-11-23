import { assertNever } from '../assert-never.ts';
import type { Painter } from '../contract/painter.ts';
import { INK } from './ink.ts';
import type { Emblem, Headgear, HeldItem } from '../contract/theme.ts';

/**
 * The costume pieces of a `PersonLook` (ADR 0003, the costume amendment): a cape, an emblem, headgear
 * and a held item. Each is drawn at whole art pixels around the person the sprite renderer has laid
 * out; `x` is the person's centre line and every other argument is a row it has already worked out.
 */

const ARROW_SHAFT = '#8a6442';
const BOWSTRING = '#d8dde6';

/** Where the person stands this frame. */
export interface Stance {
  /** The centre line. */
  x: number;
  /** The feet. */
  y: number;
  /** The feet, lifted a pixel on a bobbing frame: the torso spans `body - 13` to `body - 7`. */
  body: number;
  /** 1 for a broader build, else 0. */
  wide: 0 | 1;
}

/**
 * A cape, behind everything else: it shows either side of the legs and between them. `sway` (-1, 0 or 1)
 * pulls the fall a pixel to one side, so it trails a walker.
 */
export function drawCape(painter: Painter, colour: string, { x, y, body, wide }: Stance, sway: number): void {
  const left = x - 6 - wide;
  const width = 12 + 2 * wide;
  painter.rect(colour, left, body - 13, width, 6);
  painter.rect(colour, left + sway, body - 7, width, y - 2 - (body - 7));
}

/** The cape over the shoulders, in front of the arms: the part that shows above a desk. */
export function drawMantle(painter: Painter, colour: string, { x, body, wide }: Stance): void {
  painter.rect(colour, x - 6 - wide, body - 13, 2, 1);
  painter.rect(colour, x + 4 + wide, body - 13, 2, 1);
}

/** A fainted person's cape, spread on the floor under them. */
export function drawFallenCape(painter: Painter, colour: string, x: number, y: number): void {
  painter.rect(colour, x - 8, y - 6, 12, 5);
  painter.rect(colour, x - 9, y - 5, 1, 3);
}

/** The chest mark, with its halo underneath. `time` drives the halo's pulse. */
export function drawEmblem(painter: Painter, emblem: Emblem, { x, body }: Stance, time: number): void {
  const rows = emblem.pixels;
  const width = Math.max(0, ...rows.map((row) => row.length));
  const left = x - Math.ceil(width / 2);
  const top = body - 13;
  if (emblem.glow !== undefined) drawHalo(painter, emblem.glow, rows, left, top, time);
  rows.forEach((row, r) => {
    row.forEach((colour, c) => {
      if (colour !== null) painter.rect(colour, left + c, top + r, 1, 1);
    });
  });
}

/** A translucent ring one pixel proud of the mark, corners left off, breathing about three times in four seconds. */
function drawHalo(
  painter: Painter,
  colour: string,
  rows: Emblem['pixels'],
  left: number,
  top: number,
  time: number,
): void {
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  rows.forEach((row, r) => {
    row.forEach((pixel, c) => {
      if (pixel === null) return;
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    });
  });
  if (maxC < minC) return;
  const x = left + minC;
  const y = top + minR;
  const w = maxC - minC + 1;
  const h = maxR - minR + 1;
  painter.withAlpha(0.5 + 0.2 * Math.sin(time * 4.7), () => {
    painter.rect(colour, x - 1, y, w + 2, h);
    painter.rect(colour, x, y - 1, w, 1);
    painter.rect(colour, x, y + h, w, 1);
  });
}

/** True when the headgear leaves the eyes and mouth to be drawn as on a bare head. */
export function showsFace(gear: Headgear | undefined): boolean {
  return gear === undefined || gear.kind === 'cowl';
}

/** Headgear over a head whose top-left pixel is (`x - 4`, `headY`). `glance` shifts the eyes when walking. */
export function drawHeadgear(painter: Painter, gear: Headgear, x: number, headY: number, glance: number): void {
  switch (gear.kind) {
    case 'helmet':
      painter.rect(gear.shell, x - 4, headY - 1, 8, 8);
      painter.rect(gear.face, x - 3, headY + 1, 6, 4);
      painter.rect(gear.face, x - 2, headY + 5, 4, 1);
      painter.rect(gear.eyes, x - 3, headY + 3, 2, 1);
      painter.rect(gear.eyes, x + 1, headY + 3, 2, 1);
      return;
    case 'mask':
      painter.rect(gear.colour, x - 4, headY, 8, 7);
      painter.rect(gear.eyes, x - 3 + glance, headY + 2, 2, 2);
      painter.rect(gear.eyes, x + 1 + glance, headY + 2, 2, 2);
      return;
    case 'cowl':
      painter.rect(gear.colour, x - 4, headY - 1, 8, 5);
      painter.rect(gear.colour, x - 4, headY + 4, 1, 2);
      painter.rect(gear.colour, x + 3, headY + 4, 1, 2);
      if (gear.mark !== undefined) painter.rect(gear.mark, x - 1, headY, 2, 1);
      return;
    default:
      return assertNever(gear, 'headgear');
  }
}

/** A fainted person's head, lying with its crown to the right: a 6 by 6 block from (`x + 4`, `y - 6`). */
export function drawFallenHeadgear(painter: Painter, gear: Headgear, x: number, y: number): void {
  switch (gear.kind) {
    case 'helmet':
      painter.rect(gear.shell, x + 4, y - 6, 6, 6);
      painter.rect(gear.face, x + 4, y - 5, 5, 4);
      painter.rect(gear.eyes, x + 5, y - 4, 1, 1);
      painter.rect(gear.eyes, x + 7, y - 4, 1, 1);
      return;
    case 'mask':
      painter.rect(gear.colour, x + 4, y - 6, 6, 6);
      painter.rect(gear.eyes, x + 5, y - 5, 1, 2);
      painter.rect(gear.eyes, x + 7, y - 5, 1, 2);
      return;
    case 'cowl':
      painter.rect(gear.colour, x + 7, y - 6, 3, 6);
      painter.rect(INK, x + 7, y - 4, 1, 1);
      return;
    default:
      return assertNever(gear, 'headgear');
  }
}

/** The patch over the left eye and its strap up over the crown. */
export function drawEyepatch(painter: Painter, x: number, headY: number, glance: number): void {
  painter.rect(INK, x + 1 + glance, headY + 3, 2, 2);
  painter.rect(INK, x + 3, headY + 3, 1, 1);
  painter.rect(INK, x - 1 + glance, headY + 2, 2, 1);
  painter.rect(INK, x - 3, headY + 1, 2, 1);
  painter.rect(INK, x - 4, headY, 1, 1);
}

/** A held item in the hand on the viewer's right. `hand` is the row of the hand, which swings a pixel when walking. */
export function drawHeld(painter: Painter, held: HeldItem, { x, body, wide }: Stance, hand: number): void {
  const arm = x + 4 + wide;
  switch (held.kind) {
    case 'shield': {
      const left = arm - 2;
      const top = hand - 5;
      painter.rect(held.rim, left + 2, top, 3, 7);
      painter.rect(held.rim, left + 1, top + 1, 5, 5);
      painter.rect(held.rim, left, top + 2, 7, 3);
      painter.rect(held.band, left + 2, top + 1, 3, 5);
      painter.rect(held.band, left + 1, top + 2, 5, 3);
      painter.rect(held.rim, left + 2, top + 2, 3, 3);
      painter.rect(held.boss, left + 3, top + 3, 1, 1);
      return;
    }
    case 'hammer':
      painter.rect(held.haft, arm + 1, hand - 3, 1, 6);
      painter.rect(held.head, arm - 1, hand - 6, 5, 3);
      return;
    case 'bow':
      painter.rect(BOWSTRING, arm + 2, hand - 7, 1, 10);
      painter.rect(held.limbs, arm + 2, hand - 8, 1, 1);
      painter.rect(held.limbs, arm + 3, hand - 7, 1, 2);
      painter.rect(held.limbs, arm + 4, hand - 5, 1, 6);
      painter.rect(held.limbs, arm + 3, hand + 1, 1, 2);
      painter.rect(held.limbs, arm + 2, hand + 3, 1, 1);
      if (held.quiver !== undefined) {
        const back = x - 7 - wide;
        painter.rect(ARROW_SHAFT, back, body - 15, 2, 2);
        painter.rect(held.quiver, back, body - 17, 1, 2);
        painter.rect(held.quiver, back + 1, body - 16, 1, 1);
      }
      return;
    default:
      return assertNever(held, 'held item');
  }
}
