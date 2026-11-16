import type { Painter, TextAlign, TextStyle } from '../contract/painter.ts';
import { drawText, textWidth } from '../engine/pixel-font.ts';

/** The slice of the 2D context the painter uses, so a test can pass a small fake. */
export type PaintContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'fillRect' | 'clearRect' | 'globalAlpha' | 'save' | 'restore' | 'beginPath' | 'rect' | 'clip'
>;

/** Draws on a canvas. `scale` is whole device pixels per art pixel. */
export class CanvasPainter implements Painter {
  constructor(
    private readonly context: PaintContext,
    private readonly scale: number,
  ) {}

  rect(colour: string, x: number, y: number, w: number, h: number): void {
    this.context.fillStyle = colour;
    this.fill(Math.round(x), Math.round(y), w, h);
  }

  text(text: string, x: number, y: number, colour: string, style: TextStyle = {}): void {
    const bold = style.bold === true;
    const left = Math.round(x - this.alignOffset(style.align ?? 'left', textWidth(text, bold)));
    this.context.fillStyle = colour;
    drawText((fx, fy, w, h) => this.fill(fx, fy, w, h), text, left, Math.round(y), bold);
  }

  textWidth(text: string, bold = false): number {
    return textWidth(text, bold);
  }

  withAlpha(alpha: number, draw: () => void): void {
    const outer = this.context.globalAlpha;
    this.context.globalAlpha = outer * alpha;
    try {
      draw();
    } finally {
      this.context.globalAlpha = outer;
    }
  }

  withClip(x: number, y: number, w: number, h: number, draw: () => void): void {
    this.context.save();
    try {
      this.context.beginPath();
      this.context.rect(x * this.scale, y * this.scale, w * this.scale, h * this.scale);
      this.context.clip();
      draw();
    } finally {
      this.context.restore();
    }
  }

  /** Clears the whole art area. */
  clear(width: number, height: number): void {
    this.context.clearRect(0, 0, width * this.scale, height * this.scale);
  }

  private fill(x: number, y: number, w: number, h: number): void {
    this.context.fillRect(x * this.scale, y * this.scale, w * this.scale, h * this.scale);
  }

  private alignOffset(align: TextAlign, width: number): number {
    if (align === 'centre') return width / 2;
    if (align === 'right') return width;
    return 0;
  }
}
