import type {
  CiPodWorkload,
  Findings,
  LabEvent,
  ServiceWorkload,
  SiteInstanceWorkload,
  Snapshot,
  Vm,
  VmRole,
  Workload,
} from '../../src/contract/snapshot.ts';
import type { EngineEvent } from '../../src/engine/events.ts';
import type { EventBus } from '../../src/engine/event-bus.ts';

const SITES: readonly (readonly [string, string, SiteInstanceWorkload['env']])[] = [
  ['scrd', 'server', 'develop'],
  ['scrd', 'client', 'develop'],
  ['scrd', 'admin', 'develop'],
  ['scrd', 'site', 'develop'],
  ['bsra', 'bsra', 'develop'],
  ['bsra', 'bsra', 'staging'],
  ['bsra', 'bsra', 'production'],
  ['forms-api', 'api', 'develop'],
  ['forms-api', 'api', 'production'],
  ['lab-test', 'web', 'develop'],
  ['lab-test', 'blog', 'develop'],
  ['lab-test', 'api', 'develop'],
];

/** The twelve site instance ids, in desk order. */
export const SITE_IDS: readonly string[] = SITES.map(([client, site, env]) => `${client}-${site}-${env}`);

export function site(id: string, cpu = 40, mem = 40): SiteInstanceWorkload {
  return {
    kind: 'site-instance',
    id,
    client: 'lab',
    site: id,
    env: 'develop',
    siteType: 'node-api',
    cpu,
    mem,
    health: 'healthy',
  };
}

function service(kind: ServiceWorkload['kind'], id: string): ServiceWorkload {
  return { kind, id, name: id, cpu: 20, mem: 20, health: 'healthy' };
}

export function pod(id: string): CiPodWorkload {
  return { kind: 'ci-pod', id, cpu: 90, mem: 50 };
}

function vm(role: VmRole, workloads: Workload[]): Vm {
  return { id: `sls-${role}`, role, name: `sls-${role}`, up: true, cpu: 40, mem: 40, workloads };
}

/**
 * A mutable lab: the four VMs, twelve site instances, the four platform services and two engines.
 * Change it, then take a Snapshot; each Snapshot gets a fresh `at`.
 */
export class Lab {
  readonly vms: Vm[] = [
    vm('data', [service('engine', 'postgres'), service('engine', 'mysql')]),
    vm('compute', [
      ...SITE_IDS.map((id) => site(id)),
      ...['traefik', 'cloudflared-1', 'cloudflared-2', 'gatus'].map((id) => service('platform', id)),
    ]),
    vm('deploy', []),
    vm('ci', []),
  ];
  findings: Findings = { ok: 10, warn: 0, crit: 0 };
  private tick = 0;

  vm(role: VmRole): Vm {
    const found = this.vms.find((candidate) => candidate.role === role);
    if (found === undefined) throw new Error(`No ${role} VM`);
    return found;
  }

  workload(id: string): Workload {
    for (const candidate of this.vms) {
      const found = candidate.workloads.find((workload) => workload.id === id);
      if (found !== undefined) return found;
    }
    throw new Error(`No workload ${id}`);
  }

  siteInstance(id: string): SiteInstanceWorkload {
    const found = this.workload(id);
    if (found.kind !== 'site-instance') throw new Error(`${id} is not a site instance`);
    return found;
  }

  remove(id: string): void {
    for (const candidate of this.vms)
      candidate.workloads = candidate.workloads.filter((workload) => workload.id !== id);
  }

  snapshot(events: LabEvent[] = []): Snapshot {
    this.tick += 1;
    const at = new Date(Date.UTC(2026, 10, 16, 9, 0, this.tick)).toISOString();
    const snapshot: Snapshot = {
      v: 1,
      at,
      host: { name: 'sls-host', cpu: 30, mem: 40, findings: this.findings },
      vms: this.vms.map((candidate) => ({ ...candidate, workloads: candidate.up ? candidate.workloads : [] })),
      events: events.map((event) => ({ ...event, at })),
    };
    return structuredClone(snapshot);
  }
}

export function deploy(phase: 'started' | 'healthy' | 'rolled-back', subject: string): LabEvent {
  return { kind: 'deploy', phase, subject, at: '' };
}

export function backup(phase: 'started' | 'finished' | 'failed'): LabEvent {
  return { kind: 'backup', phase, at: '' };
}

export function oom(subject: string): LabEvent {
  return { kind: 'oom', subject, at: '' };
}

/** Everything published on a bus, in order. */
export function record(bus: EventBus): EngineEvent[] {
  const events: EngineEvent[] = [];
  const kinds = ['speech', 'log', 'paper', 'visitor'] as const;
  for (const kind of kinds) bus.subscribe(kind, (event) => events.push(event));
  return events;
}

export function said(events: readonly EngineEvent[], speakerId?: string): string[] {
  return events.flatMap((event) =>
    event.kind === 'speech' && (speakerId === undefined || event.speakerId === speakerId) ? [event.text] : [],
  );
}

export function logged(events: readonly EngineEvent[]): string[] {
  return events.flatMap((event) => (event.kind === 'log' ? [event.text] : []));
}

/** Advances the engine `seconds` in frame-sized steps, stopping early once `until` holds. */
export function run(engine: { update(dt: number): void }, seconds: number, until?: () => boolean): boolean {
  for (let t = 0; t < seconds; t += 0.05) {
    engine.update(0.05);
    if (until?.() === true) return true;
  }
  return until === undefined;
}
