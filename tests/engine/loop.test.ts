import { describe, expect, it } from 'vitest';
import { Loop, MAX_FRAME_SECONDS } from '../../src/engine/loop.ts';

/** A hand-cranked requestAnimationFrame. */
function frames() {
  let pending: ((timeMs: number) => void) | null = null;
  let handle = 0;
  const cancelled: number[] = [];
  return {
    request: (callback: (timeMs: number) => void): number => {
      pending = callback;
      handle += 1;
      return handle;
    },
    cancel: (id: number): void => {
      cancelled.push(id);
      pending = null;
    },
    fire(timeMs: number): void {
      const callback = pending;
      pending = null;
      callback?.(timeMs);
    },
    get waiting(): boolean {
      return pending !== null;
    },
    cancelled,
  };
}

describe('Loop', () => {
  it('passes the time since the last frame, capped at 0.25 s', () => {
    const clock = frames();
    const dts: number[] = [];
    const loop = new Loop(clock.request, clock.cancel, (dt) => dts.push(dt));
    loop.start();
    clock.fire(1000);
    clock.fire(1016);
    clock.fire(3000);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016);
    expect(dts[2]).toBe(MAX_FRAME_SECONDS);
    expect(MAX_FRAME_SECONDS).toBe(0.25);
  });

  it('plays a slow display in real time, down to 4 frames a second', () => {
    const clock = frames();
    const dts: number[] = [];
    const loop = new Loop(clock.request, clock.cancel, (dt) => dts.push(dt));
    loop.start();
    clock.fire(0);
    clock.fire(200);
    expect(dts[1]).toBeCloseTo(0.2);
  });

  it('still calls the frame while paused, with no time passing', () => {
    const clock = frames();
    const dts: number[] = [];
    const loop = new Loop(clock.request, clock.cancel, (dt) => dts.push(dt));
    loop.start();
    clock.fire(0);
    loop.paused = true;
    clock.fire(16);
    clock.fire(32);
    expect(dts).toEqual([0, 0, 0]);
    expect(clock.waiting).toBe(true);
  });

  it('cancels the pending frame on stop, and starts once only', () => {
    const clock = frames();
    let calls = 0;
    const loop = new Loop(clock.request, clock.cancel, () => (calls += 1));
    loop.start();
    loop.start();
    clock.fire(0);
    loop.stop();
    expect(clock.cancelled).toEqual([2]);
    expect(clock.waiting).toBe(false);
    clock.fire(16);
    expect(calls).toBe(1);
  });

  it('can be stopped from inside a frame', () => {
    const clock = frames();
    const loop: Loop = new Loop(clock.request, clock.cancel, () => loop.stop());
    loop.start();
    clock.fire(0);
    expect(clock.waiting).toBe(false);
  });

  it('keeps delivering frames after one throws, and lets the error out', () => {
    const clock = frames();
    let calls = 0;
    const loop = new Loop(clock.request, clock.cancel, () => {
      calls += 1;
      if (calls === 1) throw new Error('bad frame');
    });
    loop.start();
    expect(() => clock.fire(0)).toThrow('bad frame');
    expect(clock.waiting).toBe(true);
    clock.fire(16);
    expect(calls).toBe(2);
  });
});
