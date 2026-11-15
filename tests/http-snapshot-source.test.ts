import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpSnapshotSource } from '../src/source/http-snapshot-source.ts';
import { readFixtureJson } from './helpers.ts';

const url = new URL('http://localhost/snapshot.json');

function sourceReturning(response: Response | Error): { source: HttpSnapshotSource; fetchFn: typeof fetch } {
  const fetchFn = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { source: new HttpSnapshotSource(url, fetchFn), fetchFn };
}

afterEach(() => vi.restoreAllMocks());

describe('HttpSnapshotSource', () => {
  it('returns the snapshot and bypasses the cache', async () => {
    const { source, fetchFn } = sourceReturning(new Response(readFixtureJson('snapshot.sample.json')));
    const snapshot = await source.fetch();
    expect(snapshot?.vms).toHaveLength(4);
    expect(fetchFn).toHaveBeenCalledWith(url, { cache: 'no-store', signal: expect.any(AbortSignal) });
  });

  it('returns null on 404', async () => {
    expect(await sourceReturning(new Response('nope', { status: 404 })).source.fetch()).toBeNull();
  });

  it('returns null on a network error', async () => {
    expect(await sourceReturning(new TypeError('offline')).source.fetch()).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    expect(await sourceReturning(new Response('{ nope')).source.fetch()).toBeNull();
  });

  it('returns null on the wrong shape', async () => {
    expect(await sourceReturning(new Response(JSON.stringify({ v: 2, at: 'x', vms: [] }))).source.fetch()).toBeNull();
    expect(
      await sourceReturning(new Response(JSON.stringify({ v: 1, at: 'x', vms: [{ id: 1 }] }))).source.fetch(),
    ).toBeNull();
  });

  it('warns when a fetched body is rejected, but not on a 404', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await sourceReturning(new Response('nope', { status: 404 })).source.fetch();
    expect(warn).not.toHaveBeenCalled();

    await sourceReturning(new Response(JSON.stringify({ v: 2 }))).source.fetch();
    await sourceReturning(new Response('{ nope')).source.fetch();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('returns null when the request times out', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    expect(await new HttpSnapshotSource(url, fetchFn, 10).fetch()).toBeNull();
  });
});
