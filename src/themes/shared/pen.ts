import type { Painter, TextAlign } from '../../contract/painter.ts';

/** Short names for the two calls the set dressing makes thousands of times. Coordinates snap to whole art pixels. */
export interface Pen {
  R(colour: string, x: number, y: number, w: number, h: number): void;
  T(text: string, x: number, y: number, colour: string, align?: TextAlign, bold?: boolean): void;
}

export function pen(painter: Painter): Pen {
  return {
    R: (colour, x, y, w, h) => painter.rect(colour, Math.round(x), Math.round(y), w, h),
    T: (text, x, y, colour, align = 'left', bold = false) =>
      painter.text(text, Math.round(x), Math.round(y), colour, { align, bold }),
  };
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
