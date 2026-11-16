/** A frame never advances time by more than this, so a tab coming back from the background does not jump. */
export const MAX_FRAME_SECONDS = 0.05;

/** The render loop. `requestFrame` and `cancelFrame` are injected so a test can drive it by hand. */
export class Loop {
  /** While paused, `frame(0)` is still called so the page keeps drawing. */
  paused = false;
  private handle: number | null = null;
  private lastMs: number | null = null;

  constructor(
    private readonly requestFrame: (callback: (timeMs: number) => void) => number,
    private readonly cancelFrame: (handle: number) => void,
    private readonly frame: (dt: number) => void,
  ) {}

  start(): void {
    if (this.handle !== null) return;
    this.lastMs = null;
    this.handle = this.requestFrame(this.tick);
  }

  stop(): void {
    if (this.handle === null) return;
    this.cancelFrame(this.handle);
    this.handle = null;
  }

  private readonly tick = (timeMs: number): void => {
    const elapsed = this.lastMs === null ? 0 : (timeMs - this.lastMs) / 1000;
    this.lastMs = timeMs;
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsed));
    this.frame(this.paused ? 0 : dt);
    // `frame` may have stopped the loop.
    if (this.handle !== null) this.handle = this.requestFrame(this.tick);
  };
}
