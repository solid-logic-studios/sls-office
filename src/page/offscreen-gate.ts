import type { Loop } from '../engine/loop.ts';

/** The part of an `IntersectionObserver` entry the gate reads. */
export interface VisibilityEntry {
  readonly isIntersecting: boolean;
}

export interface VisibilityObserver {
  observe(target: Element): void;
}

/** Builds an observer that reports batches of entries; the browser's `IntersectionObserver` fits it. */
export type ObserverFactory = (callback: (entries: readonly VisibilityEntry[]) => void) => VisibilityObserver;

/**
 * Stops the loop while `target` is out of view and starts it again when it returns. Within a batch the
 * last entry is the current state. A hidden target reports not intersecting, so the loop is held until
 * the target is shown. `Loop.start` resets its clock, so resuming does not jump.
 */
export function stopWhileOffScreen(
  target: Element,
  loop: Pick<Loop, 'start' | 'stop'>,
  observe: ObserverFactory,
): void {
  observe((entries) => {
    const latest = entries[entries.length - 1];
    if (latest === undefined) return;
    if (latest.isIntersecting) loop.start();
    else loop.stop();
  }).observe(target);
}
