import { describe, expect, it } from 'vitest';
import { Sheet, type SheetParts } from '../../src/page/sheet.ts';

function setup() {
  const focused: string[] = [];
  const focusable = (name: string) => ({ focus: () => void focused.push(name) });
  const root = { hidden: true, ...focusable('sheet') };
  const trigger = focusable('trigger');
  let click: () => void = () => {};
  let keydown: (event: { key: string }) => void = () => {};
  const active = { current: trigger };
  const doc: SheetParts['doc'] = {
    addEventListener: (_type, listener) => {
      keydown = listener;
    },
  };
  const toggles: boolean[] = [];
  const sheet = new Sheet(
    {
      root,
      closeButton: { addEventListener: (_type, listener) => void (click = listener) },
      activeElement: () => active.current,
      doc,
    },
    (open) => toggles.push(open),
  );
  return { sheet, root, focused, toggles, click: () => click(), press: (key: string) => keydown({ key }), active };
}

describe('Sheet', () => {
  it('starts closed, opens, and moves focus to the sheet', () => {
    const { sheet, root, focused } = setup();
    expect(sheet.isOpen).toBe(false);
    sheet.open();
    expect(sheet.isOpen).toBe(true);
    expect(root.hidden).toBe(false);
    expect(focused).toEqual(['sheet']);
  });

  it('returns focus to the previous element on close', () => {
    const { sheet, focused } = setup();
    sheet.open();
    sheet.close();
    expect(sheet.isOpen).toBe(false);
    expect(focused).toEqual(['sheet', 'trigger']);
  });

  it('closes on the close button and on Escape, but not on other keys', () => {
    const { sheet, click, press } = setup();
    sheet.open();
    press('Enter');
    expect(sheet.isOpen).toBe(true);
    press('Escape');
    expect(sheet.isOpen).toBe(false);
    sheet.open();
    click();
    expect(sheet.isOpen).toBe(false);
  });

  it('keeps the first return target when opened again to swap content', () => {
    const { sheet, active, focused } = setup();
    sheet.open();
    active.current = { focus: () => void focused.push('sheet-again') };
    sheet.open();
    sheet.close();
    expect(focused.at(-1)).toBe('trigger');
  });

  it('ignores Escape and close while already closed, and reports each toggle', () => {
    const { sheet, press, toggles, focused } = setup();
    press('Escape');
    sheet.close();
    expect(focused).toEqual([]);
    sheet.open();
    sheet.close();
    expect(toggles).toEqual([true, false]);
  });
});
