import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../src/contract/snapshot.ts';
import { Poller } from '../src/page/poller.ts';
import type { SnapshotSource } from '../src/source/snapshot-source.ts';
import { FixtureSnapshotSource } from '../src/source/fixture-snapshot-source.ts';
import { loadFixture } from './helpers.ts';

/** A source whose fetches stay pending until the test resolves them, oldest first. */
function deferredSource(): {
  source: SnapshotSource;
  fetch: ReturnType<typeof vi.fn<SnapshotSource['fetch']>>;
  resolveNext: (snapshot: Snapshot | null) => void;
} {
  const resolvers: ((snapshot: Snapshot | null) => void)[] = [];
  const fetch = vi.fn<SnapshotSource['fetch']>(() => new Promise((resolve) => resolvers.push(resolve)));
  return { source: { fetch }, fetch, resolveNext: (snapshot) => resolvers.shift()?.(snapshot) };
}

describe('Poller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delivers new snapshots as the source changes', async () => {
    const first = loadFixture('snapshot.sample.json');
    const second = loadFixture('snapshot.all-working.json');
    const source = new FixtureSnapshotSource(first);
    const seen: (Snapshot | null)[] = [];
    const poller = new Poller(source, 5_000, (snapshot) => seen.push(snapshot));

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([first]);

    source.set(second);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(seen).toEqual([first, second]);

    source.set(null);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(seen).toEqual([first, second, null]);
    poller.stop();
  });

  it('stops polling on stop()', async () => {
    const source = new FixtureSnapshotSource(loadFixture('snapshot.sample.json'));
    const seen: (Snapshot | null)[] = [];
    const poller = new Poller(source, 5_000, (snapshot) => seen.push(snapshot));

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    poller.stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(seen).toHaveLength(1);
  });

  it('does not overlap fetches while one is pending', async () => {
    const pending = deferredSource();
    const poller = new Poller(pending.source, 5_000, () => undefined);

    poller.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pending.fetch).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('ignores the in-flight result of an earlier start after stop() then start()', async () => {
    const pending = deferredSource();
    const seen: (Snapshot | null)[] = [];
    const poller = new Poller(pending.source, 5_000, (snapshot) => seen.push(snapshot));
    const stale = loadFixture('snapshot.sample.json');
    const current = loadFixture('snapshot.all-working.json');

    poller.start();
    poller.stop();
    poller.start();
    pending.resolveNext(stale);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([]);

    pending.resolveNext(current);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([current]);
    poller.stop();
  });
});
