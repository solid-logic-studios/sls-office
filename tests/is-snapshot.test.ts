import { describe, expect, it } from 'vitest';
import type { LabEvent, Snapshot, Vm, Workload } from '../src/contract/snapshot.ts';
import { isSnapshot } from '../src/source/is-snapshot.ts';
import { VALID_FIXTURES, loadFixture } from './helpers.ts';

const AT = '2026-01-01T00:00:00Z';

const WORKLOADS: Workload[] = [
  {
    kind: 'site-instance',
    id: 'scrd-server-develop',
    client: 'scrd',
    site: 'server',
    env: 'develop',
    siteType: 'node-api',
    cpu: 10,
    mem: 20,
    health: 'healthy',
  },
  { kind: 'platform', id: 'traefik', name: 'traefik', cpu: 1, mem: 2, health: 'healthy' },
  { kind: 'engine', id: 'postgres', name: 'postgres', cpu: 1, mem: 2, health: 'healthy' },
  { kind: 'runner', id: 'runner-1', name: 'runner-1', cpu: 1, mem: 2, health: 'healthy' },
  { kind: 'ci-pod', id: 'pod-1', cpu: 1, mem: 2 },
];

const EVENTS: LabEvent[] = [
  { kind: 'deploy', phase: 'started', subject: 'scrd-server-develop', at: AT },
  { kind: 'backup', phase: 'finished', at: AT },
  { kind: 'oom', subject: 'scrd-server-develop', at: AT },
  { kind: 'vm-down', subject: 'sls-compute', at: AT },
  { kind: 'vm-up', subject: 'sls-compute', at: AT },
];

function vm(over: Partial<Vm> = {}): Vm {
  return { id: 'compute', role: 'compute', name: 'sls-compute', up: true, cpu: 10, mem: 20, workloads: [], ...over };
}

function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    v: 1,
    at: AT,
    host: { name: 'pve', cpu: 10, mem: 20, findings: { ok: 1, warn: 0, crit: 0 } },
    vms: [vm()],
    events: [],
    ...over,
  };
}

/** A Snapshot with one thing replaced by something the contract does not allow. */
function broken(over: Record<string, unknown>): unknown {
  return { ...snapshot(), ...over };
}

function withWorkload(workload: unknown): unknown {
  return broken({ vms: [{ ...vm(), workloads: [workload] }] });
}

describe('isSnapshot', () => {
  it.each(VALID_FIXTURES)('accepts %s', (name) => {
    expect(isSnapshot(loadFixture(name))).toBe(true);
  });

  it('accepts one workload and one event of every kind', () => {
    expect(isSnapshot(snapshot({ vms: [vm({ workloads: WORKLOADS })], events: EVENTS }))).toBe(true);
  });

  it.each([
    ['a host with no findings', broken({ host: { name: 'pve', cpu: 1, mem: 1 } })],
    ['an empty host', broken({ host: {} })],
    ['an unknown VM role', broken({ vms: [{ ...vm(), role: 'edge' }] })],
    ['a workload of {}', withWorkload({})],
    ['a site instance with an unknown env', withWorkload({ ...WORKLOADS[0], env: 'qa' })],
    ['a service with no name', withWorkload({ kind: 'platform', id: 'traefik', cpu: 1, mem: 2, health: 'healthy' })],
    ['an unknown workload kind', withWorkload({ kind: 'cron', id: 'x', cpu: 1, mem: 2 })],
    ['an event with an unknown kind', broken({ events: [{ kind: 'reboot', subject: 'x', at: AT }] })],
    [
      'a deploy event with a bad phase',
      broken({ events: [{ kind: 'deploy', phase: 'paused', subject: 'x', at: AT }] }),
    ],
    ['a fault event with no subject', broken({ events: [{ kind: 'oom', at: AT }] })],
    ['a null in workloads', withWorkload(null)],
    ['a null in events', broken({ events: [null] })],
  ])('rejects %s', (_name, value) => {
    expect(isSnapshot(value)).toBe(false);
  });
});
