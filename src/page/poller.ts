import type { Snapshot } from '../contract/snapshot.ts';
import type { SnapshotSource } from '../source/snapshot-source.ts';

/**
 * Polls a source on an interval and hands each result (including `null`) to a callback.
 * A tick is skipped while a poll is in flight, and results from before a `stop()` or `start()` are dropped.
 */
export class Poller {
  private timer: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  private inFlight = false;

  constructor(
    private readonly source: SnapshotSource,
    private readonly intervalMs: number,
    private readonly onSnapshot: (snapshot: Snapshot | null) => void,
  ) {}

  start(): void {
    if (this.timer !== undefined) return;
    this.generation += 1;
    this.inFlight = false;
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    void this.poll();
  }

  stop(): void {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.generation += 1;
    this.inFlight = false;
  }

  private async poll(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    const generation = this.generation;
    let snapshot: Snapshot | null = null;
    try {
      snapshot = await this.source.fetch();
    } catch {
      // A source that throws is treated as missing, so one bad poll never wedges the loop.
    }
    if (generation !== this.generation) return;
    this.inFlight = false;
    this.onSnapshot(snapshot);
  }
}
