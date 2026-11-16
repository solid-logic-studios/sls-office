import { describe, expect, it } from 'vitest';
import {
  ADVANCE,
  BOLD_ADVANCE,
  CAP_HEIGHT,
  GLYPHS,
  GLYPH_WIDTH,
  UNKNOWN_GLYPH,
  drawText,
  textWidth,
} from '../../src/engine/pixel-font.ts';

interface Run {
  x: number;
  y: number;
  w: number;
  h: number;
}

function runsOf(text: string, x: number, baselineY: number, bold = false): Run[] {
  const runs: Run[] = [];
  drawText((rx, ry, w, h) => runs.push({ x: rx, y: ry, w, h }), text, x, baselineY, bold);
  return runs;
}

const REQUIRED = `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?:;'"-+/#%()*_=<>&@$[]`;

describe('pixel font metrics', () => {
  it('measures plain and bold text', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('OFFICE')).toBe(6 * ADVANCE);
    expect(textWidth('OFFICE', true)).toBe(6 * BOLD_ADVANCE);
    expect(CAP_HEIGHT).toBe(7);
  });
});

describe('pixel font glyphs', () => {
  it.each([...REQUIRED])('has a 7 by 5 glyph for %j', (char) => {
    const glyph = GLYPHS[char];
    expect(glyph).toBeDefined();
    expect(glyph).toHaveLength(CAP_HEIGHT);
    for (const row of glyph ?? []) expect(row).toMatch(/^[#.]{5}$/);
  });

  it('draws lower case as upper case', () => {
    expect(runsOf('hello, world', 3, 20)).toEqual(runsOf('HELLO, WORLD', 3, 20));
  });

  it('draws an unknown character as a hollow box', () => {
    const runs = runsOf('~', 0, 7);
    expect(runs.length).toBeGreaterThan(0);
    expect(UNKNOWN_GLYPH).toHaveLength(CAP_HEIGHT);
    // Top and bottom rows are solid, the middle rows are two separate pixels.
    expect(runs.filter((run) => run.y === 0)).toEqual([{ x: 0, y: 0, w: 5, h: 1 }]);
    expect(runs.filter((run) => run.y === 3)).toHaveLength(2);
  });

  it.each([
    ['0', 'O'],
    ['1', 'I'],
    ['5', 'S'],
    ['8', 'B'],
    ['2', 'Z'],
  ])('keeps %s distinct from %s', (a, b) => {
    expect(GLYPHS[a]).not.toEqual(GLYPHS[b]);
  });

  it('gives every character its own look', () => {
    const seen = new Map<string, string>();
    for (const char of REQUIRED) {
      const key = (GLYPHS[char] ?? []).join('/');
      expect(seen.get(key), `${char} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, char);
    }
  });
});

describe('drawText', () => {
  it('merges a row of three pixels into one fill', () => {
    // The top row of "A" is .###. : one run of three, starting one column in.
    const top = runsOf('A', 10, 27).filter((run) => run.y === 20);
    expect(top).toEqual([{ x: 11, y: 20, w: 3, h: 1 }]);
  });

  it('keeps ink inside the expected box', () => {
    const text = 'Office 42!';
    const x = 4;
    const baseline = 30;
    const runs = runsOf(text, x, baseline);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) {
      expect(run.h).toBe(1);
      expect(run.x).toBeGreaterThanOrEqual(x);
      expect(run.x + run.w).toBeLessThanOrEqual(x + textWidth(text) - (ADVANCE - GLYPH_WIDTH));
      expect(run.y).toBeGreaterThanOrEqual(baseline - CAP_HEIGHT);
      expect(run.y).toBeLessThanOrEqual(baseline - 1);
    }
  });

  it('sits the bottom row just above the baseline', () => {
    const ys = runsOf('L', 0, 50).map((run) => run.y);
    expect(Math.max(...ys)).toBe(49);
    expect(Math.min(...ys)).toBe(43);
  });

  it('draws bold as a one pixel smear and stays inside its wider box', () => {
    const plain = runsOf('I', 0, 7);
    const bold = runsOf('I', 0, 7, true);
    expect(plain.filter((run) => run.y === 0)).toEqual([{ x: 1, y: 0, w: 3, h: 1 }]);
    expect(bold.filter((run) => run.y === 0)).toEqual([{ x: 1, y: 0, w: 4, h: 1 }]);
    for (const run of runsOf('HI', 0, 7, true)) expect(run.x + run.w).toBeLessThanOrEqual(2 * BOLD_ADVANCE - 1);
  });

  it('advances by the bold width between characters', () => {
    const firstOfSecond = runsOf('II', 0, 7, true).filter((run) => run.y === 0)[1];
    expect(firstOfSecond?.x).toBe(BOLD_ADVANCE + 1);
  });
});
