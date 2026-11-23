import type { ServiceWorkload, Vm, VmRole } from '../../contract/snapshot.ts';
import type { StageView } from '../../contract/theme.ts';

/** Lab lookups the HQ's dressing, the Spire's and their hover text share: a VM by role, and what it reports. */

/** The lab's VMs, from a stage or a Snapshot's list. */
type Vms = Pick<StageView, 'vms'>;

/** The VM in `role`, if the lab reports one. */
export const vmOf = ({ vms }: Vms, role: VmRole): Vm | undefined => vms.find((vm) => vm.role === role);

/** Whether the VM in `role` is up: a missing VM is not. */
export const isUp = (lab: Vms, role: VmRole): boolean => vmOf(lab, role)?.up ?? false;

/** Whether the CI runner is reported down (a missing one is not down, just absent). */
export const ciDown = (lab: Vms): boolean => vmOf(lab, 'ci')?.up === false;

/** The deploy runner, where the deploy VM lists it. */
export const runnerOf = (lab: Vms): ServiceWorkload | undefined =>
  vmOf(lab, 'deploy')?.workloads.find((w): w is ServiceWorkload => w.kind === 'runner');

/** `n` and the word, plural unless `n` is one. */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
