import { describe, expect, it } from 'vitest';
import type { VmRole } from '../../src/contract/snapshot.ts';
import { EventBus } from '../../src/engine/event-bus.ts';
import { DIARY_WINDOW_MS, OfficeDiary } from '../../src/page/audio/office-diary.ts';
import { Lab } from '../support/lab.ts';

const HOUR = 60 * 60 * 1000;

function keep() {
  const bus = new EventBus();
  const clock = { ms: Date.UTC(2026, 10, 17, 0, 0) };
  const diary = new OfficeDiary(bus, () => clock.ms);
  const sample = (cpus: Partial<Record<VmRole, number>>): void => {
    const lab = new Lab();
    for (const vm of lab.vms) vm.up = cpus[vm.role] !== undefined;
    for (const vm of lab.vms) vm.cpu = cpus[vm.role] ?? 0;
    diary.noteSnapshot(lab.snapshot());
  };
  return { bus, clock, diary, sample };
}

describe('OfficeDiary', () => {
  it('counts healthy deploys, rollbacks, faults and backups, and ignores the rest', () => {
    const { bus, diary } = keep();
    const at = '';
    bus.publish({ kind: 'deploy', phase: 'started', subject: 'a', at });
    bus.publish({ kind: 'deploy', phase: 'healthy', subject: 'a', at });
    bus.publish({ kind: 'deploy', phase: 'healthy', subject: 'b', at });
    bus.publish({ kind: 'deploy', phase: 'rolled-back', subject: 'c', at });
    bus.publish({ kind: 'oom', subject: 'a', at });
    bus.publish({ kind: 'vm-down', subject: 'sls-ci', at });
    bus.publish({ kind: 'vm-up', subject: 'sls-ci', at });
    bus.publish({ kind: 'backup', phase: 'started', at });
    bus.publish({ kind: 'backup', phase: 'finished', at });
    bus.publish({ kind: 'backup', phase: 'failed', at });
    expect(diary.summary()).toEqual({
      deploys: 2,
      rollbacks: 1,
      faults: 2,
      backupsFinished: 1,
      backupsFailed: 1,
      busiest: null,
      calmest: null,
    });
  });

  it('forgets events more than 24 hours old', () => {
    const { bus, clock, diary } = keep();
    bus.publish({ kind: 'oom', subject: 'a', at: '' });
    clock.ms += DIARY_WINDOW_MS - 1;
    bus.publish({ kind: 'oom', subject: 'b', at: '' });
    expect(diary.summary().faults).toBe(2);
    clock.ms += 2;
    expect(diary.summary().faults).toBe(1);
  });

  it('names the busiest and calmest role by mean CPU', () => {
    const { diary, sample } = keep();
    sample({ data: 10, compute: 80, ci: 40 });
    sample({ data: 20, compute: 60, ci: 40 });
    expect(diary.summary()).toMatchObject({ busiest: 'compute', calmest: 'data' });
  });

  it('skips a VM that is down, and gives one role busiest only', () => {
    const { diary, sample } = keep();
    sample({ compute: 50 });
    expect(diary.summary()).toMatchObject({ busiest: 'compute', calmest: null });
  });

  it('drops CPU samples from before the window', () => {
    const { clock, diary, sample } = keep();
    sample({ data: 95, compute: 5 });
    clock.ms += DIARY_WINDOW_MS + HOUR;
    sample({ data: 10, compute: 30 });
    expect(diary.summary()).toMatchObject({ busiest: 'compute', calmest: 'data' });
  });

  it('keeps only hours wholly inside the window', () => {
    const { clock, diary, sample } = keep();
    clock.ms += 30 * 60 * 1000;
    sample({ data: 95, compute: 5 });
    clock.ms += DIARY_WINDOW_MS - 10 * 60 * 1000;
    sample({ data: 10, compute: 30 });
    expect(diary.summary()).toMatchObject({ busiest: 'compute', calmest: 'data' });
  });

  it('names neither room when busiest and calmest tie', () => {
    const { diary, sample } = keep();
    sample({ data: 0, compute: 0, ci: 0 });
    expect(diary.summary()).toMatchObject({ busiest: null, calmest: null });
  });

  it('keeps nothing once disposed from the bus', () => {
    const { bus, diary } = keep();
    diary.dispose();
    bus.publish({ kind: 'oom', subject: 'a', at: '' });
    expect(diary.summary().faults).toBe(0);
  });
});
