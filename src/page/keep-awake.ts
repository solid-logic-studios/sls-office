import type { VisibilitySource } from './visibility.ts';

/** The slice of the Screen Wake Lock API used, so a test can stand in for the browser. */
export type ScreenWakeLock = Pick<WakeLock, 'request'>;

/**
 * Keeps the screen on while the Office is open (the feed is fresh and the canvas shows), so a phone left on
 * a stand does not dim. The browser drops the lock whenever the page is hidden, so it is taken again when the
 * page is shown. Where the API is missing or refuses (no secure context, low battery), the screen sleeps as usual.
 */
export class KeepAwake {
  private wanted = false;
  private sentinel: WakeLockSentinel | null = null;
  private requesting = false;

  constructor(
    private readonly wakeLock: ScreenWakeLock | null,
    private readonly page: VisibilitySource,
  ) {
    page.addEventListener('visibilitychange', () => this.sync());
  }

  /** Whether the Office is open and the screen should stay on. */
  set open(value: boolean) {
    if (value === this.wanted) return;
    this.wanted = value;
    this.sync();
  }

  private sync(): void {
    if (this.wanted && !this.page.hidden) this.acquire();
    else this.drop();
  }

  private acquire(): void {
    if (this.wakeLock === null || this.sentinel !== null || this.requesting) return;
    this.requesting = true;
    this.wakeLock.request('screen').then(
      (sentinel) => {
        this.requesting = false;
        this.sentinel = sentinel;
        sentinel.addEventListener('release', () => {
          if (this.sentinel === sentinel) this.sentinel = null;
        });
        // The Office may have closed, or the page been hidden, while the request was in flight.
        if (!this.wanted || this.page.hidden) this.drop();
      },
      () => {
        this.requesting = false;
      },
    );
  }

  private drop(): void {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel !== null) void sentinel.release().catch(() => {});
  }
}

/** The browser's wake lock, or `null` where it is not offered. */
export function browserWakeLock(): ScreenWakeLock | null {
  return 'wakeLock' in navigator ? navigator.wakeLock : null;
}
