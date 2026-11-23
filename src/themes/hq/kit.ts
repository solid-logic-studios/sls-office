import type { Painter } from '../../contract/painter.ts';

/** Drawing helpers for round, glowing things: the Painter only has rectangles, so a disc is a stack of rows. */

export const TAU = Math.PI * 2;

/** A smooth 0 to 1 wave: one full swing every `period` seconds. Whole-stage glows use this, never a hard flash. */
export const wave = (now: number, period: number, phase = 0): number =>
  0.5 + 0.5 * Math.sin((now / period) * TAU + phase);

/** Half the width of a pixel disc of radius `r` on the row `dy` from its centre. */
const halfWidth = (r: number, dy: number): number => Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - dy * dy));

/**
 * A filled pixel disc, `2r + 1` across, centred on the pixel (`cx`, `cy`). Rows of the same width are
 * painted as one rectangle. A radius below zero paints nothing.
 */
export function disc(painter: Painter, colour: string, cx: number, cy: number, r: number): void {
  if (r < 0) return;
  let start = -r;
  for (let dy = -r + 1; dy <= r + 1; dy++) {
    if (dy <= r && halfWidth(r, dy) === halfWidth(r, start)) continue;
    const half = halfWidth(r, start);
    painter.rect(colour, cx - half, cy + start, half * 2 + 1, dy - start);
    start = dy;
  }
}

/** One pixel (or a `size` square) at a whole art pixel. */
export function dot(painter: Painter, colour: string, x: number, y: number, size = 1): void {
  painter.rect(colour, Math.round(x), Math.round(y), size, size);
}

/** A point on a flattened, tilted ring: the building block of every orbit on stage. */
export interface Orbit {
  /** Radius along the ring's long axis, in art pixels. */
  radius: number;
  /** Short axis as a share of the long one: 1 is a circle seen face on, 0 is edge on. */
  squash: number;
  /** How far the ring leans, in radians. */
  tilt: number;
}

export interface OrbitPoint {
  x: number;
  y: number;
  /** True on the half of the ring that passes in front of whatever it circles. */
  front: boolean;
}

/** Where the angle `a` of `orbit` lands, relative to the ring's centre. */
export function orbitPoint({ radius, squash, tilt }: Orbit, a: number): OrbitPoint {
  const x = Math.cos(a) * radius;
  const y = Math.sin(a) * radius * squash;
  return {
    x: x * Math.cos(tilt) - y * Math.sin(tilt),
    y: x * Math.sin(tilt) + y * Math.cos(tilt),
    front: Math.sin(a) > 0,
  };
}
