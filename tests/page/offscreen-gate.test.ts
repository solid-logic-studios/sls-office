import { describe, expect, it } from 'vitest';
import { stopWhileOffScreen, type VisibilityEntry } from '../../src/page/offscreen-gate.ts';

function setup() {
  const calls: string[] = [];
  let report: (entries: readonly VisibilityEntry[]) => void = () => {};
  const observed: Element[] = [];
  const target = {} as Element;
  stopWhileOffScreen(target, { start: () => calls.push('start'), stop: () => calls.push('stop') }, (callback) => {
    report = callback;
    return { observe: (element) => observed.push(element) };
  });
  return {
    calls,
    observed,
    target,
    report: (...flags: boolean[]) => report(flags.map((isIntersecting) => ({ isIntersecting }))),
  };
}

describe('stopping the loop while off screen', () => {
  it('observes the target', () => {
    const gate = setup();
    expect(gate.observed).toEqual([gate.target]);
  });

  it('stops when scrolled out and starts when back in', () => {
    const gate = setup();
    gate.report(false);
    gate.report(true);
    expect(gate.calls).toEqual(['stop', 'start']);
  });

  it('lets the last entry in a batch win', () => {
    const gate = setup();
    gate.report(true, false);
    gate.report(false, true);
    expect(gate.calls).toEqual(['stop', 'start']);
  });

  it('ignores an empty batch', () => {
    const gate = setup();
    gate.report();
    expect(gate.calls).toEqual([]);
  });

  it('holds the loop while the canvas is hidden at load, then starts it once it is shown', () => {
    const gate = setup();
    gate.report(false);
    expect(gate.calls).toEqual(['stop']);
    gate.report(true);
    expect(gate.calls).toEqual(['stop', 'start']);
  });
});
