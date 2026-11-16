import { describe, expect, it } from 'vitest';
import { MIN_LEGIBLE_CSS_SCALE, stageScale } from '../../src/page/stage.ts';

const ART_WIDTH = 660;

describe('stageScale', () => {
  it('never drops below the legible scale on a phone, so the stage pans instead', () => {
    expect(MIN_LEGIBLE_CSS_SCALE).toBe(2);
    expect(stageScale(375, ART_WIDTH, 3, 0)).toBe(6);
  });

  it('uses the largest whole scale that fits a desktop width', () => {
    expect(stageScale(1360, ART_WIDTH, 1, 0)).toBe(2);
    expect(stageScale(2000, ART_WIDTH, 2, 0)).toBe(6);
  });

  it('zooms in and out in whole CSS steps', () => {
    expect(stageScale(1360, ART_WIDTH, 1, 1)).toBe(3);
    expect(stageScale(1360, ART_WIDTH, 1, -1)).toBe(1);
    expect(stageScale(2000, ART_WIDTH, 2, 1)).toBe(8);
    expect(stageScale(375, ART_WIDTH, 3, -1)).toBe(3);
  });

  it('rounds a fractional device pixel ratio to whole device pixels', () => {
    expect(stageScale(1360, ART_WIDTH, 1.25, 0)).toBe(3);
  });

  it('clamps to 1 and 12', () => {
    expect(stageScale(1360, ART_WIDTH, 1, -10)).toBe(1);
    expect(stageScale(375, ART_WIDTH, 0.5, -5)).toBe(1);
    expect(stageScale(5000, ART_WIDTH, 3, 10)).toBe(12);
  });
});
