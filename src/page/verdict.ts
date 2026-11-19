import type { Snapshot, Vm, Workload } from '../contract/snapshot.ts';
import type { LabSubject, Severity, Tip } from '../contract/theme.ts';
import { steadyMood, vitalsOf } from '../engine/mood.ts';

export type VerdictLevel = 'ok' | 'watch' | 'trouble';

/** One row of the trouble list. */
export interface Issue {
  /** Never `ok`: an Issue is something to look at. */
  severity: Severity;
  /** Short enough for one list row. */
  text: string;
  /** What the detail sheet shows when the row is tapped. Built from Snapshot fields only. */
  tip: Tip;
}

export interface Verdict {
  level: VerdictLevel;
  vmsUp: number;
  vmsTotal: number;
  /** Counted over workloads that report health, so CI pods are left out. */
  workloadsHealthy: number;
  workloadsTotal: number;
  pods: number;
  crit: number;
  warn: number;
  /** Critical before warning, otherwise in Snapshot order. */
  issues: readonly Issue[];
}

export const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

function workloadDetail(vm: Vm, workload: Workload): string {
  switch (workload.kind) {
    case 'site-instance':
      return `${workload.siteType} site, ${workload.env}, on ${vm.name}`;
    case 'ci-pod':
      return `CI pod on ${vm.name}`;
    default:
      return `${workload.name}, on ${vm.name}`;
  }
}

function healthOf(workload: Workload): string | null {
  return workload.kind === 'ci-pod' ? null : workload.health;
}

/** Why a VM or workload is worth a look, or null when it is fine. */
function issueFor(subject: LabSubject): Issue | null {
  const vitals = vitalsOf(subject);
  const isVm = subject.kind === 'vm';
  const name = isVm ? subject.vm.name : subject.workload.id;
  const source = isVm ? subject.vm : subject.workload;
  const base = { cpu: source.cpu, mem: source.mem };
  const detail = isVm ? `${subject.vm.role} VM` : workloadDetail(subject.vm, subject.workload);

  const issue = (severity: 'crit' | 'warn', text: string, status: string): Issue => ({
    severity,
    text,
    tip: { title: name, detail, ...base, status, severity },
  });

  if (isVm && !subject.vm.up) return issue('crit', `${name} is down`, 'offline');
  const health = isVm ? null : healthOf(subject.workload);
  if (health === 'unhealthy' || health === 'down') return issue('crit', `${name} ${health}`, health);
  if (health === 'starting') return issue('warn', `${name} starting`, health);
  const mood = steadyMood(vitals);
  if (mood === 'stressed' || mood === 'swamped') return issue('warn', `${name} is ${mood}`, mood);
  return null;
}

/**
 * The page's answer to "is the lab healthy?", a pure function of the Snapshot. It counts from the
 * Snapshot, never from the cast, so a subject with no Place (overflow) is still counted and listed.
 *
 * Workloads on a down VM raise no Issue of their own: the VM's row already says so, and their health
 * words are the last thing the collector heard, so they do not count as healthy either.
 */
export function verdictOf(snapshot: Snapshot): Verdict {
  const { host, vms } = snapshot;
  const { crit, warn } = host.findings;
  const issues: Issue[] = [];
  let workloadsHealthy = 0;
  let workloadsTotal = 0;
  let pods = 0;

  if (crit > 0) {
    issues.push(findingsIssue(snapshot, 'crit', crit));
  }
  if (warn > 0) {
    issues.push(findingsIssue(snapshot, 'warn', warn));
  }

  for (const vm of vms) {
    const vmIssue = issueFor({ kind: 'vm', vm });
    if (vmIssue !== null) issues.push(vmIssue);
    for (const workload of vm.workloads) {
      const health = healthOf(workload);
      if (health === null) {
        pods += 1;
      } else {
        workloadsTotal += 1;
        if (vm.up && health === 'healthy') workloadsHealthy += 1;
      }
      if (!vm.up) continue;
      const issue = issueFor({ kind: 'workload', vm, workload });
      if (issue !== null) issues.push(issue);
    }
  }

  // Array.prototype.sort is stable, so Snapshot order holds within a severity.
  issues.sort((a, b) => Number(b.severity === 'crit') - Number(a.severity === 'crit'));
  const level: VerdictLevel = issues.some((i) => i.severity === 'crit')
    ? 'trouble'
    : issues.length > 0
      ? 'watch'
      : 'ok';

  return {
    level,
    vmsUp: vms.filter((vm) => vm.up).length,
    vmsTotal: vms.length,
    workloadsHealthy,
    workloadsTotal,
    pods,
    crit,
    warn,
    issues,
  };
}

function findingsIssue(snapshot: Snapshot, severity: 'crit' | 'warn', count: number): Issue {
  const { host } = snapshot;
  const word = severity === 'crit' ? 'critical' : 'warning';
  const text = plural(count, `${word} finding`);
  return {
    severity,
    text,
    tip: {
      title: host.name,
      detail: `${text} on the host`,
      cpu: host.cpu,
      mem: host.mem,
      status: word,
      severity,
    },
  };
}
