import { describe, expect, it } from 'vitest';
import { probeWithSlop, ringOffsets, TAP_SLOP_CSS_PX } from '../../src/page/tap-slop.ts';

describe('ringOffsets', () => {
  it('spaces points evenly on a ring of the given radius', () => {
    const ring = ringOffsets(10, 4);
    expect(ring).toHaveLength(4);
    for (const { dx, dy } of ring) expect(Math.hypot(dx, dy)).toBeCloseTo(10);
    expect(ring[0]?.dx).toBeCloseTo(10);
    expect(ring[1]?.dy).toBeCloseTo(10);
  });
});

describe('probeWithSlop', () => {
  it('returns a direct hit without probing further', () => {
    const calls: [number, number][] = [];
    const hit = probeWithSlop(
      (x, y) => {
        calls.push([x, y]);
        return 'direct';
      },
      5,
      6,
      1,
    );
    expect(hit).toBe('direct');
    expect(calls).toEqual([[5, 6]]);
  });

  it('retries on a ring converted to art pixels and takes the first hit', () => {
    // 2 CSS px per art px: 22 CSS px is 11 art px.
    const target = { x: 111, y: 50 };
    const hit = probeWithSlop((x, y) => (Math.hypot(x - target.x, y - target.y) < 1 ? 'near' : null), 100, 50, 2);
    expect(hit).toBe('near');
  });

  it('misses when nothing is within the slop', () => {
    expect(probeWithSlop(() => null, 0, 0, 3)).toBeNull();
  });

  it('does not reach past the radius', () => {
    const far = (x: number): string | null => (x > 100 + TAP_SLOP_CSS_PX / 2 + 1 ? 'far' : null);
    expect(probeWithSlop((x) => far(x), 100, 0, 2)).toBeNull();
  });

  it('only probes the tap point when the scale is unknown', () => {
    let calls = 0;
    probeWithSlop(
      () => {
        calls += 1;
        return null;
      },
      0,
      0,
      0,
    );
    expect(calls).toBe(1);
  });
});
