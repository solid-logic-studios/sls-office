/**
 * Painter: the only drawing surface the Engine and Themes use.
 *
 * Coordinates are art pixels (the Theme's `layout.width` by `layout.height` grid); the page scales
 * them to the screen. Text is drawn in the built-in pixel font, capitals only, so its width is the
 * same in a test as in a browser.
 */

export type TextAlign = 'left' | 'centre' | 'right';

export interface TextStyle {
  /** Where `x` sits in the text. Default `left`. */
  align?: TextAlign;
  bold?: boolean;
}

export interface Painter {
  rect(colour: string, x: number, y: number, w: number, h: number): void;
  /** `y` is the baseline. */
  text(text: string, x: number, y: number, colour: string, style?: TextStyle): void;
  textWidth(text: string, bold?: boolean): number;
  /** Runs `draw` with everything it paints at `alpha` (0 to 1). */
  withAlpha(alpha: number, draw: () => void): void;
  /** Runs `draw` with painting limited to the rectangle. */
  withClip(x: number, y: number, w: number, h: number, draw: () => void): void;
}
