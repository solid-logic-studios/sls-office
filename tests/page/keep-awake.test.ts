import { describe, expect, it } from 'vitest';
import { KeepAwake, type ScreenWakeLock } from '../../src/page/keep-awake.ts';
import type { VisibilitySource } from '../../src/page/visibility.ts';

/** A page whose visibility the test flips, firing `visibilitychange` like a browser. */
class FakePage implements VisibilitySource {
  hidden = false;
  private readonly listeners = new Set<EventListenerOrEventListenerObject>();

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.add(listener);
  }

  show(hidden: boolean): void {
    this.hidden = hidden;
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(new Event('visibilitychange'));
    }
  }
}

/** A wake lock that counts how many locks are held, and drops them all when the page hides. */
class FakeWakeLock implements ScreenWakeLock {
  held = 0;
  requests = 0;
  refuse = false;
  private readonly sentinels = new Set<EventTarget & { fire: () => void }>();

  request(): Promise<WakeLockSentinel> {
    this.requests += 1;
    if (this.refuse) return Promise.reject(new Error('NotAllowedError'));
    this.held += 1;
    const target = new EventTarget();
    let released = false;
    const fire = (): void => {
      if (released) return;
      released = true;
      this.held -= 1;
      this.sentinels.delete(sentinel);
      target.dispatchEvent(new Event('release'));
    };
    const sentinel = Object.assign(target, {
      fire,
      release: (): Promise<void> => {
        fire();
        return Promise.resolve();
      },
    });
    this.sentinels.add(sentinel);
    return Promise.resolve(sentinel as unknown as WakeLockSentinel);
  }

  /** What a browser does when the page is hidden. */
  dropAll(): void {
    for (const sentinel of [...this.sentinels]) sentinel.fire();
  }
}

function rig() {
  const page = new FakePage();
  const lock = new FakeWakeLock();
  const keepAwake = new KeepAwake(lock, page);
  return { page, lock, keepAwake };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('KeepAwake', () => {
  it('holds the screen on while the Office is open and lets it go when it closes', async () => {
    const { lock, keepAwake } = rig();
    expect(lock.held).toBe(0);
    keepAwake.open = true;
    await settle();
    expect(lock.held).toBe(1);
    keepAwake.open = true;
    await settle();
    expect(lock.requests).toBe(1);
    keepAwake.open = false;
    await settle();
    expect(lock.held).toBe(0);
  });

  it('takes the lock again when a hidden page is shown', async () => {
    const { page, lock, keepAwake } = rig();
    keepAwake.open = true;
    await settle();
    page.show(true);
    lock.dropAll();
    await settle();
    expect(lock.held).toBe(0);
    page.show(false);
    await settle();
    expect(lock.held).toBe(1);
  });

  it('does not take the lock while hidden or closed', async () => {
    const { page, lock, keepAwake } = rig();
    page.show(true);
    keepAwake.open = true;
    await settle();
    expect(lock.requests).toBe(0);
    keepAwake.open = false;
    page.show(false);
    await settle();
    expect(lock.requests).toBe(0);
  });

  it('lets go of a lock granted after the Office closed', async () => {
    const { lock, keepAwake } = rig();
    keepAwake.open = true;
    keepAwake.open = false;
    await settle();
    expect(lock.held).toBe(0);
  });

  it('carries on when the browser refuses or offers no lock', async () => {
    const { lock, keepAwake } = rig();
    lock.refuse = true;
    keepAwake.open = true;
    await settle();
    expect(lock.held).toBe(0);

    const none = new KeepAwake(null, new FakePage());
    expect(() => (none.open = true)).not.toThrow();
  });
});
