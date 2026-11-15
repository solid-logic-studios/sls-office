import { describe, expect, it } from 'vitest';
import { columnsFor, scaleFor } from '../src/page/renderer.ts';

describe('columnsFor', () => {
  it.each([
    [559, 2],
    [560, 4],
    [1000, 4],
    [320, 2],
  ])('%i px wide is %i columns', (width, columns) => {
    expect(columnsFor(width)).toBe(columns);
  });
});

describe('scaleFor', () => {
  it.each([
    [40, 1],
    [120, 6],
    [2000, 8],
  ])('a %i px cell scales by %i', (cellWidth, scale) => {
    expect(scaleFor(cellWidth)).toBe(scale);
  });
});
