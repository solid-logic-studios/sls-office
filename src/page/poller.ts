import type { Snapshot } from '../contract/snapshot.ts';
import type { SnapshotSource } from '../source/snapshot-source.ts';

/** Polls a source on an interval and hands each result (including `null`) to a callback. */
export class Poller {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly source: SnapshotSource,
    private readonly intervalMs: number,
    private readonly onSnapshot: (snapshot: Snapshot | null) => void,
  ) {}

  start(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    void this.poll();
  }

  stop(): void {
    if (this.timer === undefined) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async poll(): Promise<void> {
    const snapshot = await this.source.fetch();
    if (this.timer !== undefined) this.onSnapshot(snapshot);
  }
}
