import type { Snapshot } from '../contract/snapshot.ts';
import { isSnapshot } from './is-snapshot.ts';
import type { SnapshotSource } from './snapshot-source.ts';

/** Below the 5 s poll interval, so a hung request never overlaps the next tick. */
export const DEFAULT_TIMEOUT_MS = 4_000;

/**
 * Reads the snapshot over HTTP, never from cache. Any failure becomes `null`; a body that was
 * fetched but rejected also logs a one-line warning, so a broken collector is visible.
 */
export class HttpSnapshotSource implements SnapshotSource {
  constructor(
    private readonly url: URL,
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async fetch(): Promise<Snapshot | null> {
    try {
      const response = await this.fetchFn(this.url, { cache: 'no-store', signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) return null;
      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.warn('snapshot.json rejected: invalid JSON');
          return null;
        }
        throw error;
      }
      if (isSnapshot(body)) return body;
      console.warn('snapshot.json rejected: not a v1 snapshot');
      return null;
    } catch {
      return null;
    }
  }
}
