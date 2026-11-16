import { describe, expect, it } from 'vitest';
import { MIN_LEGIBLE_CSS_SCALE, stageScale } from '../../src/page/stage-canvas.ts';

const ART_WIDTH = 660;

describe('stageScale', () => {
  it('never drops below the legible scale on a phone, so the stage pans instead', () => {
    expect(MIN_LEGIBLE_CSS_SCALE).toBe(1.5);
    expect(stageScale(375, ART_WIDTH, 3, 0)).toBe(5);
    expect(stageScale(375, ART_WIDTH, 2, 0)).toBe(3);
  });

  it('uses the largest whole scale that fits a desktop width', () => {
    expect(stageScale(1320, ART_WIDTH, 1, 0)).toBe(2);
    expect(stageScale(2000, ART_WIDTH, 2, 0)).toBe(6);
  });

  it('fits the width at a fractional device pixel ratio instead of rounding up past it', () => {
    const scale = stageScale(1320, ART_WIDTH, 1.25, 0);
    expect(scale).toBe(2);
    expect((ART_WIDTH * scale) / 1.25).toBeLessThanOrEqual(1320);
  });

  it('ignores floating point noise in the device pixel ratio', () => {
    expect(stageScale(375, ART_WIDTH, 2.0000000298023224, 0)).toBe(3);
    expect(stageScale(1320, ART_WIDTH, 0.9999999999, 0)).toBe(2);
  });

  it('zooms in and out in whole device pixel steps', () => {
    expect(stageScale(1320, ART_WIDTH, 1, 1)).toBe(3);
    expect(stageScale(1320, ART_WIDTH, 1, -1)).toBe(1);
    expect(stageScale(2000, ART_WIDTH, 2, 1)).toBe(7);
    expect(stageScale(375, ART_WIDTH, 3, -1)).toBe(4);
  });

  it('clamps to 1 and 12', () => {
    expect(stageScale(1320, ART_WIDTH, 1, -10)).toBe(1);
    expect(stageScale(375, ART_WIDTH, 0.5, -5)).toBe(1);
    expect(stageScale(5000, ART_WIDTH, 3, 10)).toBe(12);
  });
});
