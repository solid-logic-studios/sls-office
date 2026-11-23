import type { Painter, TextStyle } from '../../contract/painter.ts';
import type { DecorFn, Rect } from '../../contract/theme.ts';

/**
 * Moves a piece of the HQ's art to the Spire. The HQ's set dressing is drawn at fixed places on the
 * HQ's stage; `relocate` runs it through a Painter that shifts a window of that stage to a new spot.
 * Rectangles are cut to the window (so nothing spills out, even on a Painter that ignores clips)
 * and text not wholly inside it is dropped. The art is the HQ's own, frame for frame.
 */

export interface Point {
  x: number;
  y: number;
}

// Must match the pixel font's cap height (`CAP_HEIGHT`, 7); a Theme may not import the Engine.
const ascent = 7;

/**
 * A Painter that draws the window `from` of another stage at `to` on this one. Plain fields, not
 * constructor parameter properties: the image build loads every Theme with Node's strip-only
 * TypeScript (`pnpm voice-lines`), which rejects them.
 */
class WindowPainter implements Painter {
  private readonly inner: Painter;
  private readonly from: Rect;
  private readonly dx: number;
  private readonly dy: number;

  constructor(inner: Painter, from: Rect, to: Point) {
    this.inner = inner;
    this.from = from;
    this.dx = to.x - from.x;
    this.dy = to.y - from.y;
  }

  rect(colour: string, x: number, y: number, w: number, h: number): void {
    const { from } = this;
    const x0 = Math.max(x, from.x);
    const y0 = Math.max(y, from.y);
    const x1 = Math.min(x + w, from.x + from.w);
    const y1 = Math.min(y + h, from.y + from.h);
    if (x1 <= x0 || y1 <= y0) return;
    this.inner.rect(colour, x0 + this.dx, y0 + this.dy, x1 - x0, y1 - y0);
  }

  text(text: string, x: number, y: number, colour: string, style: TextStyle = {}): void {
    const w = this.inner.textWidth(text, style.bold);
    const left = style.align === 'centre' ? x - w / 2 : style.align === 'right' ? x - w : x;
    const { from } = this;
    // Text is all or nothing: a line cut by the window's edge would read as a broken word.
    if (left < from.x || left + w > from.x + from.w || y - ascent < from.y || y > from.y + from.h) return;
    this.inner.text(text, x + this.dx, y + this.dy, colour, style);
  }

  textWidth(text: string, bold?: boolean): number {
    return this.inner.textWidth(text, bold);
  }

  withAlpha(alpha: number, draw: () => void): void {
    this.inner.withAlpha(alpha, draw);
  }

  // No intersection with the window needed: `relocate` wraps every call in a clip to the window.
  withClip(x: number, y: number, w: number, h: number, draw: () => void): void {
    this.inner.withClip(x + this.dx, y + this.dy, w, h, draw);
  }
}

/** Paints the window `from` of `art` (drawn for another stage) with its top left at `to`. */
export function relocate(art: readonly DecorFn[], from: Rect, to: Point): DecorFn {
  return (painter, stage) => {
    const window = new WindowPainter(painter, from, to);
    painter.withClip(to.x, to.y, from.w, from.h, () => {
      for (const fn of art) fn(window, stage);
    });
  };
}

/** Where a window of `from` lands once moved to `to`. */
export const landed = (from: Rect, to: Point): Rect => ({ x: to.x, y: to.y, w: from.w, h: from.h });

/** Paints `art` only inside `rect`, where it is drawn: anything it would paint outside is dropped. */
export const confine = (art: DecorFn, rect: Rect): DecorFn => relocate([art], rect, rect);
