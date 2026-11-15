import type { Snapshot } from '../contract/snapshot.ts';

/** Adapter over wherever the snapshot comes from. `null` means missing or unreadable. */
export interface SnapshotSource {
  fetch(): Promise<Snapshot | null>;
}
