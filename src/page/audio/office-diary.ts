import type { VmRole, Snapshot } from '../../contract/snapshot.ts';
import type { EventBus } from '../../engine/event-bus.ts';

const HOUR_MS = 60 * 60 * 1000;
/** How far back the diary looks, and how long it keeps anything. */
export const DIARY_WINDOW_MS = 24 * HOUR_MS;

/** What the Standup sums up: the last 24 hours of the Office log, and which rooms were busiest and calmest. */
export interface DiarySummary {
  /** Deploys that came up healthy. */
  deploys: number;
  rollbacks: number;
  /** OOM kills and VMs going down. */
  faults: number;
  /** Backups that finished. */
  backupsFinished: number;
  backupsFailed: number;
  /** The role with the highest mean CPU, or `null` with no samples. */
  busiest: VmRole | null;
  /** The role with the lowest mean CPU, or `null` with fewer than two roles sampled. */
  calmest: VmRole | null;
}

type EntryKind = 'deploy' | 'rollback' | 'fault' | 'backup-finished' | 'backup-failed';

interface Entry {
  at: number;
  kind: EntryKind;
}

/** CPU samples for one role in one wall-clock hour. */
interface Bucket {
  sum: number;
  count: number;
}

/**
 * The Office's diary: what happened over the last day, kept for the Standup. It listens to the Engine's
 * bus for deploys, faults and backups, and is fed each Snapshot for the rooms' CPU, which it keeps as
 * hourly means per role. Nothing older than 24 hours is kept. It lives in memory only, so a reload starts
 * a fresh diary and a Standup soon after one sums up only what the page has seen.
 */
export class OfficeDiary {
  private entries: Entry[] = [];
  /** Per role, the CPU samples by wall-clock hour (hours since the epoch). */
  private readonly cpu = new Map<VmRole, Map<number, Bucket>>();
  private readonly unsubscribe: readonly (() => void)[];

  /** `now` is the wall clock in epoch milliseconds, injected so tests can move it. */
  constructor(
    bus: EventBus,
    private readonly now: () => number,
  ) {
    this.unsubscribe = [
      bus.subscribe('deploy', (event) => {
        if (event.phase === 'healthy') this.note('deploy');
        else if (event.phase === 'rolled-back') this.note('rollback');
      }),
      bus.subscribe('oom', () => this.note('fault')),
      bus.subscribe('vm-down', () => this.note('fault')),
      bus.subscribe('backup', (event) => {
        if (event.phase === 'finished') this.note('backup-finished');
        else if (event.phase === 'failed') this.note('backup-failed');
      }),
    ];
  }

  /** Records each VM that is up: its CPU goes into the current hour's bucket for its role. */
  noteSnapshot(snapshot: Snapshot): void {
    const hour = Math.floor(this.now() / HOUR_MS);
    this.prune();
    for (const vm of snapshot.vms) {
      if (!vm.up) continue;
      const hours = this.cpu.get(vm.role) ?? new Map<number, Bucket>();
      const bucket = hours.get(hour) ?? { sum: 0, count: 0 };
      bucket.sum += vm.cpu;
      bucket.count += 1;
      hours.set(hour, bucket);
      this.cpu.set(vm.role, hours);
    }
  }

  /** The counts over the last 24 hours and the busiest and calmest roles by mean CPU over the same stretch. */
  summary(): DiarySummary {
    this.prune();
    const count = (kind: EntryKind): number => this.entries.filter((entry) => entry.kind === kind).length;
    const means = this.meanCpuByRole().sort((a, b) => b.mean - a.mean);
    return {
      deploys: count('deploy'),
      rollbacks: count('rollback'),
      faults: count('fault'),
      backupsFinished: count('backup-finished'),
      backupsFailed: count('backup-failed'),
      busiest: means[0]?.role ?? null,
      calmest: means.length > 1 ? (means.at(-1)?.role ?? null) : null,
    };
  }

  dispose(): void {
    for (const stop of this.unsubscribe) stop();
  }

  private note(kind: EntryKind): void {
    this.prune();
    this.entries.push({ at: this.now(), kind });
  }

  /** The first wall-clock hour still inside the window. */
  private get firstHour(): number {
    return Math.floor((this.now() - DIARY_WINDOW_MS) / HOUR_MS);
  }

  private prune(): void {
    const cutoff = this.now() - DIARY_WINDOW_MS;
    this.entries = this.entries.filter((entry) => entry.at > cutoff);
    const firstHour = this.firstHour;
    for (const hours of this.cpu.values()) {
      for (const hour of hours.keys()) if (hour < firstHour) hours.delete(hour);
    }
  }

  private meanCpuByRole(): { role: VmRole; mean: number }[] {
    const means: { role: VmRole; mean: number }[] = [];
    for (const [role, hours] of this.cpu) {
      let sum = 0;
      let count = 0;
      for (const bucket of hours.values()) {
        sum += bucket.sum;
        count += bucket.count;
      }
      if (count > 0) means.push({ role, mean: sum / count });
    }
    return means;
  }
}
