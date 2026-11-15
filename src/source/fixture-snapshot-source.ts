import type { Snapshot } from '../contract/snapshot.ts';
import type { SnapshotSource } from './snapshot-source.ts';

/** In-memory source for tests; `set` simulates the file changing. */
export class FixtureSnapshotSource implements SnapshotSource {
  constructor(private snapshot: Snapshot | null) {}

  set(snapshot: Snapshot | null): void {
    this.snapshot = snapshot;
  }

  async fetch(): Promise<Snapshot | null> {
    return this.snapshot;
  }
}
