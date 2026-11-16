import type { LabEvent, Snapshot, Vm, Workload } from '../contract/snapshot.ts';
import type { EngineEvent } from './events.ts';

type VmFlip = 'vm-down' | 'vm-up';

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function reports(events: readonly LabEvent[], kind: VmFlip, subject: string): boolean {
  return events.some((event) => event.kind === kind && 'subject' in event && event.subject === subject);
}

export class SnapshotDiffer {
  private previous: Snapshot | null = null;

  /** Events between the previous Snapshot and this one. */
  diff(next: Snapshot): EngineEvent[] {
    const previous = this.previous;
    if (previous === null) {
      this.previous = next;
      return [];
    }
    // The page polls more often than the collector writes, so the same document must not replay.
    if (previous.at === next.at) return [];
    this.previous = next;

    const before = byId(previous.vms);
    const flips: EngineEvent[] = [];
    const added: EngineEvent[] = [];
    const removed: EngineEvent[] = [];

    for (const vm of next.vms) {
      const old = before.get(vm.id);
      if (!old) continue;
      if (old.up !== vm.up) {
        const kind: VmFlip = vm.up ? 'vm-up' : 'vm-down';
        if (!reports(next.events, kind, vm.id)) flips.push({ kind, subject: vm.id, at: next.at });
      }
      if (old.up && vm.up) {
        const changes = workloadChanges(vm, old);
        added.push(...changes.added);
        removed.push(...changes.removed);
      }
    }
    return [...flips, ...added, ...next.events, ...removed];
  }
}

function workloadChanges(now: Vm, was: Vm): { added: EngineEvent[]; removed: EngineEvent[] } {
  const wasById = byId(was.workloads);
  const nowById = byId(now.workloads);
  const added = now.workloads.filter((w) => !wasById.has(w.id)).map((w) => workloadEvent('workload-added', now.id, w));
  const removed = was.workloads
    .filter((w) => !nowById.has(w.id))
    .map((w) => workloadEvent('workload-removed', now.id, w));
  return { added, removed };
}

function workloadEvent(kind: 'workload-added' | 'workload-removed', vmId: string, workload: Workload): EngineEvent {
  return { kind, vmId, workload };
}
