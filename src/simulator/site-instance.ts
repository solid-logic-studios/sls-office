import type { Health, SiteInstanceWorkload } from '../contract/snapshot.ts';
import type { SiteSpec } from './catalogue.ts';
import type { GuestVm } from './guest-vm.ts';
import { type Cancel, noCancel } from './timeline.ts';
import { clamp, percent } from './util.ts';

type SiteStatus = 'ok' | 'oom' | 'unhealthy';

const HEALTH: Record<SiteStatus, Health> = { ok: 'healthy', oom: 'starting', unhealthy: 'unhealthy' };

/** One container on sls-compute, serving one site in one environment. */
export class SiteInstance {
  cpu = 20;
  mem = 50;
  /** Cancels the pending restart after an OOM kill. */
  restart: Cancel = noCancel;
  private status: SiteStatus = 'ok';
  private downForDatabase = false;

  constructor(readonly spec: SiteSpec) {}

  get isHealthy(): boolean {
    return this.status === 'ok';
  }

  /** Killed for running out of memory; the caller schedules `recover`. */
  crash(): void {
    this.status = 'oom';
    this.cpu = 0;
  }

  recover(): void {
    if (this.status !== 'oom') return;
    this.status = 'ok';
    this.mem = 30;
  }

  /** Back to healthy whatever went wrong (the presets use this). */
  heal(): void {
    this.restart();
    if (this.status === 'ok') return;
    this.status = 'ok';
    this.downForDatabase = false;
    this.mem = 40;
  }

  step(time: number, dt: number, compute: GuestVm, data: GuestVm): void {
    this.followDatabase(data.up);
    if (!compute.up || this.status === 'unhealthy') {
      this.cpu = this.mem = 0;
      return;
    }
    if (this.status === 'oom') {
      this.cpu = 0;
      return;
    }
    const { weight, wobbleRate, wobblePhase, siteType } = this.spec;
    const cpuWobble = 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(time * wobbleRate + wobblePhase));
    const wantCpu = clamp(compute.targetCpu * weight * cpuWobble, 0.5, 100);
    this.cpu += (wantCpu - this.cpu) * Math.min(1, dt * 1.5);
    const memWobble = 0.8 + 0.35 * (0.5 + 0.5 * Math.sin(time * wobbleRate * 0.6 + wobblePhase * 2));
    const wantMem = clamp(compute.targetMem * memWobble + (siteType === 'wordpress' ? 6 : 0), 5, 100);
    this.mem += (wantMem - this.mem) * Math.min(1, dt * 0.5);
  }

  /** 0 ok, 1 warn, 2 crit; a site that cannot serve is critical in production, a warning elsewhere. */
  severity(compute: GuestVm): 0 | 1 | 2 {
    if (!compute.up || this.status !== 'ok') return this.spec.env === 'production' ? 2 : 1;
    return this.cpu > 80 || this.mem > 88 ? 1 : 0;
  }

  workload(): SiteInstanceWorkload {
    const { id, client, site, env, siteType } = this.spec;
    return {
      kind: 'site-instance',
      id,
      client,
      site,
      env,
      siteType,
      cpu: percent(this.cpu),
      mem: percent(this.mem),
      health: HEALTH[this.status],
    };
  }

  private followDatabase(dataUp: boolean): void {
    if (this.spec.db === null) return;
    if (!dataUp && this.status === 'ok') {
      this.status = 'unhealthy';
      this.downForDatabase = true;
    } else if (dataUp && this.downForDatabase) {
      this.downForDatabase = false;
      if (this.status === 'unhealthy') this.status = 'ok';
    }
  }
}
