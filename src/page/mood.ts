import type { Vm } from '../contract/snapshot.ts';

/** Minimal mood model for the tracer bullet; the engine (issue #2) replaces it. */
export type Mood = 'absent' | 'break' | 'working' | 'stressed';

/** Below this CPU percentage a VM is idle, so its character is on a break. */
export const BREAK_BELOW_CPU = 10;
/** Above this CPU percentage a VM is under load, so its character is stressed. */
export const STRESSED_ABOVE_CPU = 80;

export const MOOD_LABELS: Record<Mood, string> = {
  absent: 'away',
  break: 'on a break',
  working: 'working',
  stressed: 'stressed',
};

export function moodOf(vm: Pick<Vm, 'up' | 'cpu'>): Mood {
  if (!vm.up) return 'absent';
  if (vm.cpu < BREAK_BELOW_CPU) return 'break';
  if (vm.cpu > STRESSED_ABOVE_CPU) return 'stressed';
  return 'working';
}
