import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Poller } from '../../src/page/poller.ts';
import { pollWhileVisible, type VisibilitySource } from '../../src/page/visibility.ts';
import type { SnapshotSource } from '../../src/source/snapshot-source.ts';

/** A page whose visibility the test flips, firing `visibilitychange` like a browser. */
class FakePage implements VisibilitySource {
  hidden = false;
  private readonly listeners = new Set<EventListenerOrEventListenerObject>();

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.delete(listener);
  }

  show(hidden: boolean): void {
    this.hidden = hidden;
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(new Event('visibilitychange'));
    }
  }
}

describe('pollWhileVisible', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function rig(hidden = false) {
    const fetch = vi.fn<SnapshotSource['fetch']>(() => Promise.resolve(null));
    const page = new FakePage();
    page.hidden = hidden;
    const poller = new Poller({ fetch }, 5_000, () => {});
    const detach = pollWhileVisible(poller, page);
    return { fetch, page, poller, detach };
  }

  it('polls at once and on the interval while visible', async () => {
    const { fetch } = rig();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('makes no request while hidden, and polls again at once when shown', async () => {
    const { fetch, page } = rig();
    await vi.advanceTimersByTimeAsync(0);
    page.show(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);

    page.show(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('never polls a page that loads hidden until it is shown', async () => {
    const { fetch, page } = rig(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).not.toHaveBeenCalled();
    page.show(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stops listening once detached', async () => {
    const { fetch, page, detach } = rig();
    await vi.advanceTimersByTimeAsync(0);
    detach();
    page.show(true);
    await vi.advanceTimersByTimeAsync(10_000);
    // Detached, so hiding the page no longer stops the poller: its two interval ticks still fire.
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
