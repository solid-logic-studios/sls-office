import { describe, expect, it } from 'vitest';
import { Loop } from '../../src/engine/loop.ts';
import { throttleFrames } from '../../src/page/frame-throttle.ts';

/** A fake display refreshing every `periodMs`, with a little jitter so the cadence is not perfect. */
function display(periodMs: number) {
  let pending: { id: number; callback: (timeMs: number) => void } | null = null;
  let nextId = 0;
  let tickCount = 0;
  const cancelled: number[] = [];
  return {
    request: (callback: (timeMs: number) => void): number => {
      nextId += 1;
      pending = { id: nextId, callback };
      return nextId;
    },
    cancel: (id: number): void => {
      cancelled.push(id);
      if (pending?.id === id) pending = null;
    },
    /** Runs the display for `seconds`, returning the last timestamp. */
    run(seconds: number): number {
      let now = 0;
      while (now < seconds * 1000) {
        tickCount += 1;
        now = tickCount * periodMs + (tickCount % 2 === 0 ? 0.6 : -0.6);
        const current = pending;
        pending = null;
        current?.callback(now);
      }
      return now;
    },
    get waiting(): boolean {
      return pending !== null;
    },
    cancelled,
  };
}

const INTERVAL_MS = 50;

/** A fake display with a throttle over it. */
function throttledDisplay(periodMs: number) {
  const screen = display(periodMs);
  const throttled = throttleFrames({ requestFrame: screen.request, cancelFrame: screen.cancel }, INTERVAL_MS);
  return { screen, throttled };
}

describe.each([
  ['60 Hz', 1000 / 60],
  ['120 Hz', 1000 / 120],
])('the frame throttle on a %s display', (_name, periodMs) => {
  it('delivers about 20 frames a second', () => {
    const { screen, throttled } = throttledDisplay(periodMs);
    let calls = 0;
    const onFrame = (): void => {
      calls += 1;
      throttled.requestFrame(onFrame);
    };
    throttled.requestFrame(onFrame);
    const elapsed = screen.run(10);
    const perSecond = calls / (elapsed / 1000);
    expect(perSecond).toBeGreaterThanOrEqual(19);
    expect(perSecond).toBeLessThanOrEqual(21);
  });

  it('keeps a Loop dt summing to real time', () => {
    const { screen, throttled } = throttledDisplay(periodMs);
    let total = 0;
    let frames = 0;
    const loop = new Loop(throttled.requestFrame, throttled.cancelFrame, (dt) => {
      total += dt;
      frames += 1;
    });
    loop.start();
    const elapsed = screen.run(10);
    expect(frames).toBeGreaterThan(150);
    // The first delivered frame has dt 0 and the last undelivered stretch is under one interval.
    expect(Math.abs(total - elapsed / 1000)).toBeLessThan(0.15);
  });
});

describe('cancelling a throttled frame', () => {
  it('cancels whichever underlying frame is pending, so no further callback runs', () => {
    const { screen, throttled } = throttledDisplay(1000 / 60);
    let calls = 0;
    let handle = 0;
    const onFrame = (): void => {
      calls += 1;
      handle = throttled.requestFrame(onFrame);
    };
    handle = throttled.requestFrame(onFrame);
    // The first frame is delivered at once; the re-request is then held back by the throttle.
    screen.run(0.03);
    expect(calls).toBe(1);
    expect(screen.waiting).toBe(true);
    throttled.cancelFrame(handle);
    expect(screen.waiting).toBe(false);
    screen.run(1);
    expect(calls).toBe(1);
  });

  it('stops a Loop', () => {
    const { screen, throttled } = throttledDisplay(1000 / 60);
    let frames = 0;
    const loop = new Loop(throttled.requestFrame, throttled.cancelFrame, () => {
      frames += 1;
    });
    loop.start();
    screen.run(1);
    const before = frames;
    loop.stop();
    screen.run(1);
    expect(frames).toBe(before);
  });

  it('restarts a Loop after a long stop with no jump, back at about 20 frames a second', () => {
    const { screen, throttled } = throttledDisplay(1000 / 60);
    const dts: number[] = [];
    const loop = new Loop(throttled.requestFrame, throttled.cancelFrame, (dt) => dts.push(dt));
    loop.start();
    screen.run(1);
    loop.stop();
    // The display keeps ticking for 5 s while the loop is stopped; nothing is delivered.
    const stoppedAt = dts.length;
    screen.run(6);
    expect(dts.length).toBe(stoppedAt);
    loop.start();
    const before = dts.length;
    const restartedAt = screen.run(7);
    expect(dts[before]).toBe(0);
    const resumed = dts.slice(before);
    expect(Math.max(...resumed)).toBeLessThan(0.1);
    expect(resumed.length / (restartedAt / 1000 - 6)).toBeGreaterThanOrEqual(19);
    expect(resumed.length / (restartedAt / 1000 - 6)).toBeLessThanOrEqual(21);
  });
});
