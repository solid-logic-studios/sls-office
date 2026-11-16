import type { LabSubject, Mood, Rect, Severity, Subject } from '../contract/theme.ts';

export function severityOf(mood: Mood): Severity {
  switch (mood) {
    case 'absent':
      return 'crit';
    case 'fainted':
    case 'stressed':
    case 'swamped':
      return 'warn';
    case 'break':
    case 'working':
      return 'ok';
    default: {
      const unreachable: never = mood;
      throw new Error(`Unknown mood ${String(unreachable)}`);
    }
  }
}

/** The cpu and mem a tooltip shows, where the subject has them. */
export function loadOf(subject: Subject | null): { cpu: number; mem: number } | null {
  if (subject === null) return null;
  switch (subject.kind) {
    case 'vm':
      return { cpu: subject.vm.cpu, mem: subject.vm.mem };
    case 'workload':
      return { cpu: subject.workload.cpu, mem: subject.workload.mem };
    case 'founder':
      return null;
    default: {
      const unreachable: never = subject;
      throw new Error(`Unknown subject ${String(unreachable)}`);
    }
  }
}

/** The full name a tooltip leads with: the workload id or the VM name, never shortened. */
export function titleOf(subject: LabSubject): string {
  return subject.kind === 'vm' ? subject.vm.name : subject.workload.id;
}

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
