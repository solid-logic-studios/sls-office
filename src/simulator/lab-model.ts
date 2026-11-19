import type { Findings, Host, Vm, VmRole, Workload } from '../contract/snapshot.ts';
import { ENGINE_SERVICES, PLATFORM_SERVICES, SITE_SPECS, type ServiceSpec } from './catalogue.ts';
import type { CiPod } from './ci-pod.ts';
import { GuestVm, NO_LOAD } from './guest-vm.ts';
import { PRESET_LOADS } from './presets.ts';
import { SiteInstance } from './site-instance.ts';
import { clamp, percent } from './util.ts';

export const MAX_CI_PODS = 3;

const DEPLOY_LOAD = { cpu: 50, mem: 20 };
const BACKUP_LOAD = { cpu: 45, mem: 0 };
const POD_LOAD = { cpu: 24, mem: 14 };

/** The lab's state and physics. Flows (deploys, backups, faults) live in the Simulator and flip its flags. */
export class LabModel {
  readonly data: GuestVm;
  readonly compute: GuestVm;
  readonly deploy: GuestVm;
  readonly ci: GuestVm;
  readonly guests: readonly GuestVm[];
  readonly sites: readonly SiteInstance[] = SITE_SPECS.map((spec) => new SiteInstance(spec));
  pods: CiPod[] = [];
  deploying = false;
  backingUp = false;

  constructor(random: () => number) {
    const start = PRESET_LOADS.arvo;
    this.data = new GuestVm('sls-data', 'data', start.data, random() * 6);
    this.compute = new GuestVm('sls-compute', 'compute', start.compute, random() * 6);
    this.deploy = new GuestVm('sls-deploy', 'deploy', start.deploy, random() * 6);
    this.ci = new GuestVm('sls-ci', 'ci', start.ci, random() * 6);
    this.guests = [this.data, this.compute, this.deploy, this.ci];
  }

  step(time: number, dt: number): void {
    const pods = this.pods.length;
    this.data.step(time, dt, this.backingUp ? BACKUP_LOAD : NO_LOAD);
    this.compute.step(time, dt, NO_LOAD);
    this.deploy.step(time, dt, this.deploying ? DEPLOY_LOAD : NO_LOAD);
    this.ci.step(time, dt, { cpu: pods * POD_LOAD.cpu, mem: pods * POD_LOAD.mem });
    for (const site of this.sites) site.step(time, dt, this.compute, this.data);
  }

  host(): Host {
    const { data: d, compute: c, deploy: b, ci: i } = this;
    const cpu = percent(clamp(((2 * d.cpu + 4 * c.cpu + 4 * b.cpu + 6 * i.cpu) / 16) * 0.85 + 4, 1, 100));
    return {
      name: 'pve',
      cpu,
      mem: percent(clamp(18 + ((2 * d.mem + 4 * c.mem + 4 * b.mem + 14 * i.mem) / 24) * 0.7, 1, 100)),
      findings: this.findings(),
      temps: {
        cpu: Math.round(45 + 0.45 * cpu),
        chipset: Math.round(55 + 0.15 * cpu),
        nvme: Math.round(40 + 0.2 * cpu),
      },
    };
  }

  vms(time: number): Vm[] {
    return this.guests.map((guest) => ({
      id: guest.id,
      role: guest.role,
      name: guest.id,
      up: guest.up,
      cpu: percent(guest.cpu),
      mem: percent(guest.mem),
      workloads: guest.up ? this.workloads(guest.role, time) : [],
    }));
  }

  /** The host always counts as one warning: its NVMe is worn. */
  private findings(): Findings {
    const severities = [
      1,
      ...this.guests.map((guest) => guest.severity()),
      ...this.sites.map((site) => site.severity(this.compute)),
      ...PLATFORM_SERVICES.map(() => (this.compute.up ? 0 : 2)),
    ];
    const count = (severity: number) => severities.filter((s) => s === severity).length;
    return { ok: count(0), warn: count(1), crit: count(2) };
  }

  private workloads(role: VmRole, time: number): Workload[] {
    switch (role) {
      case 'compute':
        return [...this.sites.map((site) => site.workload()), ...this.services(PLATFORM_SERVICES, this.compute, time)];
      case 'data':
        return this.services(ENGINE_SERVICES, this.data, time);
      case 'ci':
        return this.pods.map((pod) => pod.workload(time));
      case 'deploy':
        return [];
    }
  }

  private services(specs: readonly ServiceSpec[], host: GuestVm, time: number): Workload[] {
    return specs.map(({ kind, id, share }) => ({
      kind,
      id,
      name: id,
      cpu: percent(clamp(host.cpu * share * (0.8 + 0.4 * Math.sin(time + share * 9)), 1, 100)),
      mem: percent(12 + host.mem * 0.15),
      health: 'healthy',
    }));
  }
}
