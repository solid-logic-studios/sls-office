import { describe, expect, it } from 'vitest';
import type { Theme } from '../../src/contract/theme.ts';
import { chooseTheme } from '../../src/page/default-theme.ts';

/** `chooseTheme` only reads `id`, so a bare id stands in for a whole Theme. */
const themed = (id: string): Theme => ({ id }) as Theme;

const office = themed('office');
const tower = themed('tower');
const boxes = themed('boxes');
const themes = [office, tower, boxes];
const defaults = { wide: office, compact: tower };

describe('the default Theme', () => {
  it('is the Office on a wide screen with no ?theme=', () => {
    expect(chooseTheme(themes, null, false, defaults)).toBe(office);
  });

  it('is the Tower on a compact screen with no ?theme=', () => {
    expect(chooseTheme(themes, null, true, defaults)).toBe(tower);
  });

  it('lets a known ?theme= win in both modes', () => {
    expect(chooseTheme(themes, 'office', true, defaults)).toBe(office);
    expect(chooseTheme(themes, 'tower', false, defaults)).toBe(tower);
    expect(chooseTheme(themes, 'boxes', true, defaults)).toBe(boxes);
    expect(chooseTheme(themes, 'boxes', false, defaults)).toBe(boxes);
  });

  it('falls to the mode default for an unknown id', () => {
    expect(chooseTheme(themes, 'nope', false, defaults)).toBe(office);
    expect(chooseTheme(themes, 'nope', true, defaults)).toBe(tower);
  });
});
