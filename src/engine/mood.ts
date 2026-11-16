import type { LabSubject, Mood } from '../contract/theme.ts';

export interface Vitals {
  present: boolean;
  cpu: number;
  mem: number;
}

export const BREAK_BELOW_CPU = 10;
export const BREAK_ENDS_AT_CPU = 14;
export const STRESSED_ABOVE_CPU = 80;
export const SWAMPED_ABOVE_MEM = 88;
export const FAINT_SECONDS = 4.5;

export function vitalsOf(subject: LabSubject): Vitals {
  if (subject.kind === 'vm') {
    return { present: subject.vm.up, cpu: subject.vm.cpu, mem: subject.vm.mem };
  }
  const { vm, workload } = subject;
  const healthy = workload.kind === 'ci-pod' || (workload.health !== 'unhealthy' && workload.health !== 'down');
  return { present: vm.up && healthy, cpu: workload.cpu, mem: workload.mem };
}

/** One mood, and the mood that follows it. */
interface MoodState {
  readonly mood: Mood;
  next(vitals: Vitals, now: number): MoodState;
}

class SteadyState implements MoodState {
  constructor(readonly mood: Exclude<Mood, 'fainted' | 'absent'>) {}

  next(vitals: Vitals): MoodState {
    return vitals.present ? resolve(vitals, this.mood === 'break') : ABSENT;
  }
}

class AbsentState implements MoodState {
  readonly mood = 'absent';

  next(vitals: Vitals): MoodState {
    return vitals.present ? resolve(vitals, false) : this;
  }
}

class FaintedState implements MoodState {
  readonly mood = 'fainted';

  constructor(private readonly until: number) {}

  next(vitals: Vitals, now: number): MoodState {
    if (!vitals.present) return ABSENT;
    return now < this.until ? this : resolve(vitals, false);
  }
}

const WORKING = new SteadyState('working');
const STRESSED = new SteadyState('stressed');
const SWAMPED = new SteadyState('swamped');
const BREAK = new SteadyState('break');
const ABSENT = new AbsentState();

/** The mood for a present character. A break holds until CPU climbs back to `BREAK_ENDS_AT_CPU`. */
function resolve(vitals: Vitals, onBreak: boolean): MoodState {
  if (vitals.cpu > STRESSED_ABOVE_CPU) return STRESSED;
  if (vitals.mem > SWAMPED_ABOVE_MEM) return SWAMPED;
  if (vitals.cpu < BREAK_BELOW_CPU || (onBreak && vitals.cpu < BREAK_ENDS_AT_CPU)) return BREAK;
  return WORKING;
}

export class MoodMachine {
  private state: MoodState = WORKING;

  get mood(): Mood {
    return this.state.mood;
  }

  /** `now` is seconds of animation time. Returns the new mood. */
  update(vitals: Vitals, now: number): Mood {
    this.state = this.state.next(vitals, now);
    return this.state.mood;
  }

  /** An OOM kill. */
  faint(now: number): void {
    if (this.state !== ABSENT) this.state = new FaintedState(now + FAINT_SECONDS);
  }
}
