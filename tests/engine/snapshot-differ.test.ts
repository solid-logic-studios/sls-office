import { describe, expect, it } from 'vitest';
import type { CiPodWorkload, LabEvent, Snapshot, Vm } from '../../src/contract/snapshot.ts';
import { SnapshotDiffer } from '../../src/engine/snapshot-differ.ts';

const pod = (id: string): CiPodWorkload => ({ kind: 'ci-pod', id, cpu: 50, mem: 50 });

function vm(id: string, up = true, workloads: CiPodWorkload[] = []): Vm {
  return { id, role: 'ci', name: id, up, cpu: 20, mem: 20, workloads: up ? workloads : [] };
}

function snapshot(at: string, vms: Vm[], events: LabEvent[] = []): Snapshot {
  return { v: 1, at, host: { name: 'host', cpu: 10, mem: 10, findings: { ok: 0, warn: 0, crit: 0 } }, vms, events };
}

describe('SnapshotDiffer', () => {
  it('gives no events for the first Snapshot', () => {
    const events: LabEvent[] = [{ kind: 'backup', phase: 'started', at: 't1' }];
    expect(new SnapshotDiffer().diff(snapshot('t1', [vm('a')], events))).toEqual([]);
  });

  it('gives no events and changes nothing for the same `at`', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a')]));
    const repeat = snapshot('t1', [vm('a', false)], [{ kind: 'backup', phase: 'started', at: 't1' }]);
    expect(differ.diff(repeat)).toEqual([]);
    // Still compared against the first Snapshot, so the flip shows once `at` moves on.
    expect(differ.diff(snapshot('t2', [vm('a', false)]))).toEqual([{ kind: 'vm-down', subject: 'a', at: 't2' }]);
  });

  it('derives vm-down and vm-up from an up flip', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a'), vm('b', false)]));
    expect(differ.diff(snapshot('t2', [vm('a', false), vm('b')]))).toEqual([
      { kind: 'vm-down', subject: 'a', at: 't2' },
      { kind: 'vm-up', subject: 'b', at: 't2' },
    ]);
  });

  it('does not derive a flip that the Snapshot already reports', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a')]));
    const reported: LabEvent = { kind: 'vm-down', subject: 'a', at: 't2' };
    expect(differ.diff(snapshot('t2', [vm('a', false)], [reported]))).toEqual([reported]);
  });

  it('derives a flip when the Snapshot reports a different subject', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a'), vm('b')]));
    const other: LabEvent = { kind: 'vm-down', subject: 'b', at: 't2' };
    expect(differ.diff(snapshot('t2', [vm('a', false), vm('b')], [other]))).toEqual([
      { kind: 'vm-down', subject: 'a', at: 't2' },
      other,
    ]);
  });

  it('orders flips, additions, Snapshot events, then removals', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a'), vm('b', true, [pod('old')]), vm('c')]));
    const backup: LabEvent = { kind: 'backup', phase: 'finished', at: 't2' };
    const events = differ.diff(snapshot('t2', [vm('a', false), vm('b', true, [pod('new')]), vm('c')], [backup]));
    expect(events).toEqual([
      { kind: 'vm-down', subject: 'a', at: 't2' },
      { kind: 'workload-added', vmId: 'b', workload: pod('new') },
      backup,
      { kind: 'workload-removed', vmId: 'b', workload: pod('old') },
    ]);
  });

  it('gives no workload events for a new VM', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a')]));
    expect(differ.diff(snapshot('t2', [vm('a'), vm('b', true, [pod('p')])]))).toEqual([]);
  });

  it('gives no workload events across a VM going down and coming back', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a', true, [pod('p')])]));
    expect(differ.diff(snapshot('t2', [vm('a', false)]))).toEqual([{ kind: 'vm-down', subject: 'a', at: 't2' }]);
    expect(differ.diff(snapshot('t3', [vm('a', true, [pod('p')])]))).toEqual([
      { kind: 'vm-up', subject: 'a', at: 't3' },
    ]);
  });

  it('keeps a workload that is present in both Snapshots quiet', () => {
    const differ = new SnapshotDiffer();
    differ.diff(snapshot('t1', [vm('a', true, [pod('p')])]));
    expect(differ.diff(snapshot('t2', [vm('a', true, [pod('p')])]))).toEqual([]);
  });
});
