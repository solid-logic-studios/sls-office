import type { Rect } from '../../src/contract/theme.ts';
import type { RecordingPainter } from './recording-painter.ts';

/** Does `inner` lie wholly within `outer`? */
export const inside = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

/** Do the two rectangles share any area? */
export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** How many rects the painter drew wholly inside `area`, of `colour` when given. */
export const rectsIn = (painter: RecordingPainter, area: Rect, colour?: string): number =>
  painter.rects.filter((r) => inside(area, r) && (colour === undefined || r.colour === colour)).length;
