import type { ServiceWorkload, Vm } from '../../contract/snapshot.ts';
import type { StageView } from '../../contract/theme.ts';

/**
 * What JARVIS is attending to, read from the stage alone. The orb, the readout and the console all
 * follow this one answer, so they never disagree.
 *
 * - `waking`: no Snapshot yet.
 * - `alarm`: a critical finding is open or a VM is down. All hands.
 * - `backup`: the keeper is at the jet with the nightly backup.
 * - `deploy`: the deploy runner is working.
 * - `ci`: at least one CI pod is running.
 * - `night`: a quiet night, with the lab idling.
 * - `idle`: an ordinary day.
 */
export type JarvisState = 'waking' | 'alarm' | 'backup' | 'deploy' | 'ci' | 'night' | 'idle';

/** The deploy runner counts as working at or above this CPU. An idle runner sits well under it. */
export const DEPLOY_BUSY_CPU = 30;
/** A night is quiet while the host stays under this CPU. */
export const QUIET_HOST_CPU = 20;
/** The quiet hours, local time: from 22:00 until 06:00. */
export const QUIET_HOURS = { from: 22, until: 6 } as const;

const roleOf = (vms: readonly Vm[], role: Vm['role']): Vm | undefined => vms.find((vm) => vm.role === role);

/** How many CI pods are running right now. */
export const podCount = (vms: readonly Vm[]): number =>
  vms.reduce((n, vm) => n + vm.workloads.filter((w) => w.kind === 'ci-pod').length, 0);

/** The runner's own CPU where the Snapshot lists the runner, else the deploy VM's. */
function deployBusy(vms: readonly Vm[]): boolean {
  const deploy = roleOf(vms, 'deploy');
  if (deploy === undefined || !deploy.up) return false;
  const runner = deploy.workloads.find((w): w is ServiceWorkload => w.kind === 'runner');
  return (runner?.cpu ?? deploy.cpu) >= DEPLOY_BUSY_CPU;
}

const quietHour = (hour: number): boolean => hour >= QUIET_HOURS.from || hour < QUIET_HOURS.until;

/** The one thing JARVIS attends to: the most urgent state that holds. */
export function jarvisState({ host, vms, findings, vaultOpen, hour }: StageView): JarvisState {
  if (host === null) return 'waking';
  if (findings.crit > 0 || vms.some((vm) => !vm.up)) return 'alarm';
  if (vaultOpen) return 'backup';
  if (deployBusy(vms)) return 'deploy';
  if (podCount(vms) > 0) return 'ci';
  if (quietHour(hour) && host.cpu < QUIET_HOST_CPU) return 'night';
  return 'idle';
}
