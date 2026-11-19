import { describe, expect, it } from 'vitest';
import type { CiPodWorkload, Health, SiteInstanceWorkload, Vm } from '../../src/contract/snapshot.ts';
import { FAINT_SECONDS, MoodMachine, steadyMood, vitalsOf, type Vitals } from '../../src/engine/mood.ts';

const vitals = (cpu: number, mem = 50, present = true): Vitals => ({ present, cpu, mem });

function vm(overrides: Partial<Vm> = {}): Vm {
  return { id: 'vm1', role: 'compute', name: 'compute', up: true, cpu: 40, mem: 50, workloads: [], ...overrides };
}

function site(health: Health): SiteInstanceWorkload {
  return {
    kind: 'site-instance',
    id: 'w1',
    client: 'c',
    site: 's',
    env: 'production',
    siteType: 'web',
    cpu: 30,
    mem: 20,
    health,
  };
}

describe('MoodMachine', () => {
  it('starts as working', () => {
    expect(new MoodMachine().mood).toBe('working');
  });

  it.each([
    [{ cpu: 81, mem: 50 }, 'stressed'],
    [{ cpu: 80, mem: 50 }, 'working'],
    [{ cpu: 50, mem: 89 }, 'swamped'],
    [{ cpu: 50, mem: 88 }, 'working'],
    [{ cpu: 9, mem: 50 }, 'break'],
    [{ cpu: 10, mem: 50 }, 'working'],
    [{ cpu: 95, mem: 95 }, 'stressed'],
    [{ cpu: 5, mem: 95 }, 'swamped'],
  ])('resolves %j to %s', ({ cpu, mem }, expected) => {
    expect(new MoodMachine().update(vitals(cpu, mem), 0)).toBe(expected);
  });

  it('is absent when not present', () => {
    expect(new MoodMachine().update(vitals(50, 50, false), 0)).toBe('absent');
  });

  it('holds a break until CPU reaches 14', () => {
    const machine = new MoodMachine();
    expect(machine.update(vitals(9), 0)).toBe('break');
    expect(machine.update(vitals(12), 1)).toBe('break');
    expect(machine.update(vitals(14), 2)).toBe('working');
    expect(machine.update(vitals(12), 3)).toBe('working');
  });

  it('lets stress end a break', () => {
    const machine = new MoodMachine();
    machine.update(vitals(5), 0);
    expect(machine.update(vitals(90), 1)).toBe('stressed');
  });

  it('faints, then recovers after the faint time', () => {
    const machine = new MoodMachine();
    machine.faint(10);
    expect(machine.update(vitals(50), 10)).toBe('fainted');
    expect(machine.update(vitals(50), 10 + FAINT_SECONDS - 0.1)).toBe('fainted');
    expect(machine.update(vitals(50), 10 + FAINT_SECONDS)).toBe('working');
  });

  it('resolves from vitals after a faint', () => {
    const machine = new MoodMachine();
    machine.faint(0);
    expect(machine.update(vitals(95), FAINT_SECONDS)).toBe('stressed');
  });

  it('lets absent beat fainted', () => {
    const machine = new MoodMachine();
    machine.faint(0);
    expect(machine.update(vitals(50, 50, false), 1)).toBe('absent');
    expect(machine.update(vitals(50), 2)).toBe('working');
  });

  it('ignores a faint while absent', () => {
    const machine = new MoodMachine();
    machine.update(vitals(50, 50, false), 0);
    machine.faint(1);
    expect(machine.mood).toBe('absent');
    expect(machine.update(vitals(50), 2)).toBe('working');
  });

  it('resolves from vitals on coming back from absent', () => {
    const machine = new MoodMachine();
    machine.update(vitals(5), 0);
    machine.update(vitals(5, 50, false), 1);
    expect(machine.update(vitals(12), 2)).toBe('working');
  });
});

describe('vitalsOf', () => {
  it('reads a VM', () => {
    expect(vitalsOf({ kind: 'vm', vm: vm({ cpu: 12, mem: 34 }) })).toEqual({ present: true, cpu: 12, mem: 34 });
    expect(vitalsOf({ kind: 'vm', vm: vm({ up: false }) }).present).toBe(false);
  });

  it.each([
    ['healthy', true, true],
    ['starting', true, true],
    ['unhealthy', true, false],
    ['down', true, false],
    ['healthy', false, false],
  ] as const)('reads a site instance that is %s with its VM up=%s', (health, up, present) => {
    const subject = { kind: 'workload', vm: vm({ up }), workload: site(health) } as const;
    expect(vitalsOf(subject)).toEqual({ present, cpu: 30, mem: 20 });
  });

  it('treats a ci-pod as present whenever its VM is up', () => {
    const workload: CiPodWorkload = { kind: 'ci-pod', id: 'p1', cpu: 70, mem: 60 };
    expect(vitalsOf({ kind: 'workload', vm: vm(), workload })).toEqual({ present: true, cpu: 70, mem: 60 });
    expect(vitalsOf({ kind: 'workload', vm: vm({ up: false }), workload }).present).toBe(false);
  });
});

describe('steadyMood', () => {
  it.each([
    [vitals(85), 'stressed'],
    [vitals(50, 90), 'swamped'],
    [vitals(5), 'break'],
    [vitals(12), 'working'],
    [vitals(40), 'working'],
    [vitals(14), 'working'],
  ] as const)('classifies %j as %s', (v, mood) => {
    expect(steadyMood(v)).toBe(mood);
  });

  it('is absent when not present, whatever the load', () => {
    expect(steadyMood(vitals(95, 95, false))).toBe('absent');
  });

  it('agrees with a fresh MoodMachine', () => {
    for (const v of [vitals(85), vitals(50, 90), vitals(5), vitals(40), vitals(40, 40, false)]) {
      expect(steadyMood(v)).toBe(new MoodMachine().update(v, 0));
    }
  });
});
