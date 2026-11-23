import type { Host, Vm, VmRole, Workload } from '../../src/contract/snapshot.ts';
import type { StageView } from '../../src/contract/theme.ts';

/** The four VMs a calm lab runs, in Snapshot order. */
export const ROLES: readonly VmRole[] = ['data', 'compute', 'deploy', 'ci'];

export const HOST: Host = {
  name: 'pve',
  cpu: 40,
  mem: 60,
  findings: { ok: 9, warn: 1, crit: 0 },
  temps: { cpu: 58, chipset: 59, nvme: 46 },
};

/** A VM that is up and quiet; `over` changes its fields, `workloads` fills it. */
export function vm(role: VmRole, over: Partial<Vm> = {}, workloads: Workload[] = []): Vm {
  return { id: role, role, name: `sls-${role}`, up: true, cpu: 20, mem: 50, workloads, ...over };
}

/** A calm afternoon: the four VMs up and quiet, a still lift, nobody on a break. */
export function stage(over: Partial<StageView> = {}): StageView {
  return {
    now: 12.3,
    hour: 14,
    host: HOST,
    vms: ROLES.map((role) => vm(role)),
    findings: { ok: 9, warn: 1, crit: 0 },
    liftInUse: false,
    lift: { y: 242, moving: false, doorsOpen: false, calls: new Set() },
    vaultOpen: false,
    openStores: new Set(),
    busyBreakSpots: new Set(),
    ...over,
  };
}
