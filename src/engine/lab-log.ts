import type { BackupEvent, DeployEvent } from '../contract/snapshot.ts';
import type { EventBus } from './event-bus.ts';

/**
 * Words for the Office log. It listens for lab events on the bus and publishes one plain `log` line
 * for each, whatever the Theme casts, so the log tells the truth even when nobody is on stage.
 */
export class LabLog {
  private podsAdded = 0;
  private readonly unsubscribe: readonly (() => void)[];

  /** `vmName` turns a VM id into its name, falling back to the id. */
  constructor(
    private readonly bus: EventBus,
    vmName: (id: string) => string,
  ) {
    this.unsubscribe = [
      bus.subscribe('deploy', (event) => this.write(deployLine(event))),
      bus.subscribe('backup', (event) => this.write(backupLine(event))),
      bus.subscribe('oom', (event) => this.write(`OOM kill: ${event.subject} fainted and is restarting`)),
      bus.subscribe('vm-down', (event) => this.write(`${vmName(event.subject)} went down`)),
      bus.subscribe('vm-up', (event) => this.write(`${vmName(event.subject)} is back up`)),
      bus.subscribe('workload-added', (event) => {
        if (event.workload.kind === 'ci-pod') this.podsAdded += 1;
      }),
    ];
  }

  /** Called once the events of one Snapshot have all been published. */
  endSnapshot(): void {
    const count = this.podsAdded;
    this.podsAdded = 0;
    if (count > 0) this.write(`CI burst: ${count} single-use pod${count === 1 ? '' : 's'} started`);
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
  }

  private write(text: string): void {
    this.bus.publish({ kind: 'log', text });
  }
}

function deployLine(event: DeployEvent): string {
  switch (event.phase) {
    case 'started':
      return `Deploy started: ${event.subject}`;
    case 'healthy':
      return `Deploy healthy: ${event.subject} is on the new container`;
    case 'rolled-back':
      return `Deploy rolled back: ${event.subject} failed its health check, the old container keeps serving`;
    default: {
      const unreachable: never = event.phase;
      throw new Error(`Unknown deploy phase ${String(unreachable)}`);
    }
  }
}

function backupLine(event: BackupEvent): string {
  switch (event.phase) {
    case 'started':
      return 'Backup run started';
    case 'finished':
      return 'Backup run finished: the set is safe off-site';
    case 'failed':
      return 'Backup failed';
    default: {
      const unreachable: never = event.phase;
      throw new Error(`Unknown backup phase ${String(unreachable)}`);
    }
  }
}
