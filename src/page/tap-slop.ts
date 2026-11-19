/** How far from the tap a character can be and still count as tapped, in CSS pixels. */
export const TAP_SLOP_CSS_PX = 22;
const RING_STEPS = 8;

export interface Offset {
  dx: number;
  dy: number;
}

/** Points evenly spaced on a ring of `radius`, starting to the right and going clockwise on screen. */
export function ringOffsets(radius: number, steps: number = RING_STEPS): Offset[] {
  return Array.from({ length: steps }, (_, step) => {
    const angle = (step / steps) * 2 * Math.PI;
    return { dx: radius * Math.cos(angle), dy: radius * Math.sin(angle) };
  });
}

/**
 * Characters are smaller than a fingertip, so a tap that misses is retried on a ring about
 * `TAP_SLOP_CSS_PX` away (converted to art pixels) and the first hit wins. `probe` is the Engine's hit test.
 */
export function probeWithSlop<T>(
  probe: (x: number, y: number) => T | null,
  x: number,
  y: number,
  cssPerArtPixel: number,
  radiusCss: number = TAP_SLOP_CSS_PX,
): T | null {
  const direct = probe(x, y);
  if (direct !== null || !(cssPerArtPixel > 0)) return direct;
  for (const { dx, dy } of ringOffsets(radiusCss / cssPerArtPixel)) {
    const hit = probe(x + dx, y + dy);
    if (hit !== null) return hit;
  }
  return null;
}
