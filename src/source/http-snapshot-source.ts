import type { Snapshot } from '../contract/snapshot.ts';
import { isSnapshot } from './is-snapshot.ts';
import type { SnapshotSource } from './snapshot-source.ts';

/** Reads the snapshot over HTTP, never from cache. Any failure becomes `null`. */
export class HttpSnapshotSource implements SnapshotSource {
  constructor(
    private readonly url: URL,
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async fetch(): Promise<Snapshot | null> {
    try {
      const response = await this.fetchFn(this.url, { cache: 'no-store' });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      return isSnapshot(body) ? body : null;
    } catch {
      return null;
    }
  }
}
