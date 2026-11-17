import type { Poller } from './poller.ts';

/** The slice of `Document` the gate reads, so a test can drive it without a browser. */
export type VisibilitySource = Pick<Document, 'hidden' | 'addEventListener'>;

/**
 * Runs a poller only while the page is visible. Browsers throttle timers in a hidden tab but keep them
 * running, and a forgotten tab's requests keep the lab collector awake. The gate lives as long as the page.
 */
export function pollWhileVisible(poller: Pick<Poller, 'start' | 'stop'>, page: VisibilitySource): void {
  const sync = (): void => (page.hidden ? poller.stop() : poller.start());
  page.addEventListener('visibilitychange', sync);
  sync();
}
