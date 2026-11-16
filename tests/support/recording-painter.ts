import type { Painter, TextStyle } from '../../src/contract/painter.ts';

export type PaintCall =
  | { op: 'rect'; colour: string; x: number; y: number; w: number; h: number }
  | { op: 'text'; text: string; x: number; y: number; colour: string; style: TextStyle };

/** Width of one character in the built-in pixel font, in art pixels. */
const ADVANCE = 6;
const BOLD_ADVANCE = 7;

/** A Painter with no canvas: it records what was drawn, so the Engine and Themes are testable in Node. */
export class RecordingPainter implements Painter {
  readonly calls: PaintCall[] = [];

  rect(colour: string, x: number, y: number, w: number, h: number): void {
    this.calls.push({ op: 'rect', colour, x, y, w, h });
  }

  text(text: string, x: number, y: number, colour: string, style: TextStyle = {}): void {
    this.calls.push({ op: 'text', text, x, y, colour, style });
  }

  textWidth(text: string, bold = false): number {
    return text.length * (bold ? BOLD_ADVANCE : ADVANCE);
  }

  withAlpha(_alpha: number, draw: () => void): void {
    draw();
  }

  withClip(_x: number, _y: number, _w: number, _h: number, draw: () => void): void {
    draw();
  }

  get texts(): string[] {
    return this.calls.flatMap((call) => (call.op === 'text' ? [call.text] : []));
  }

  get rects(): Extract<PaintCall, { op: 'rect' }>[] {
    return this.calls.flatMap((call) => (call.op === 'rect' ? [call] : []));
  }
}
