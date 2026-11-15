import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../src/contract/snapshot.ts';
import { Poller } from '../src/page/poller.ts';
import { FixtureSnapshotSource } from '../src/source/fixture-snapshot-source.ts';
import { loadFixture } from './helpers.ts';

describe('Poller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delivers new snapshots as the source changes, and stops on stop()', async () => {
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
    await vi.advanceTimersByTimeAsync(20_000);
    expect(seen).toHaveLength(3);
  });
});
