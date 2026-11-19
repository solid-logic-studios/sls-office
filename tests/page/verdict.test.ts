import { describe, expect, it } from 'vitest';
import type { Health, SiteInstanceWorkload, Snapshot, Vm, Workload } from '../../src/contract/snapshot.ts';
import { verdictOf } from '../../src/page/verdict.ts';
import { loadFixture } from '../helpers.ts';

function site(id: string, health: Health = 'healthy', overrides: Partial<SiteInstanceWorkload> = {}): Workload {
  return {
    kind: 'site-instance',
    id,
    client: 'acme',
    site: 'shop',
    env: 'staging',
    siteType: 'nextjs',
    cpu: 40,
    mem: 40,
    health,
    ...overrides,
  };
}

function vm(overrides: Partial<Vm> = {}): Vm {
  return { id: 'v1', role: 'compute', name: 'sls-compute', up: true, cpu: 40, mem: 40, workloads: [], ...overrides };
}

function snapshot(vms: Vm[], findings: { crit: number; warn: number } = { crit: 0, warn: 0 }): Snapshot {
  const base = loadFixture('snapshot.sample.json');
  return { ...base, host: { ...base.host, findings: { ...base.host.findings, ...findings } }, vms, events: [] };
}

describe('verdictOf', () => {
  it('is ok when everything is fine', () => {
    const v = verdictOf(snapshot([vm({ workloads: [site('a'), site('b')] })]));
    expect(v).toMatchObject({
      level: 'ok',
      vmsUp: 1,
      vmsTotal: 1,
      workloadsHealthy: 2,
      workloadsTotal: 2,
      crit: 0,
      warn: 0,
    });
    expect(v.issues).toEqual([]);
  });

  it('is trouble when a VM is down, and lists the VM once, not its workloads', () => {
    const v = verdictOf(snapshot([vm({ name: 'sls-ci', up: false, workloads: [site('a'), site('b', 'unhealthy')] })]));
    expect(v.level).toBe('trouble');
    expect(v.vmsUp).toBe(0);
    expect(v.workloadsHealthy).toBe(0);
    expect(v.workloadsTotal).toBe(2);
    expect(v.issues.map((i) => i.text)).toEqual(['sls-ci is down']);
    expect(v.issues[0]?.tip).toMatchObject({ title: 'sls-ci', status: 'offline', severity: 'crit' });
  });

  it.each(['unhealthy', 'down'] as const)('is trouble when a workload is %s', (health) => {
    const v = verdictOf(snapshot([vm({ workloads: [site('acme-shop-staging', health)] })]));
    expect(v.level).toBe('trouble');
    expect(v.issues).toHaveLength(1);
    expect(v.issues[0]?.text).toBe(`acme-shop-staging ${health}`);
    expect(v.issues[0]?.tip).toEqual({
      title: 'acme-shop-staging',
      detail: 'nextjs site, staging, on sls-compute',
      cpu: 40,
      mem: 40,
      status: health,
      severity: 'crit',
    });
  });

  it('is trouble on a critical finding, even with a calm cast', () => {
    const v = verdictOf(snapshot([vm()], { crit: 2, warn: 0 }));
    expect(v.level).toBe('trouble');
    expect(v.crit).toBe(2);
    expect(v.issues[0]?.text).toBe('2 critical findings');
    expect(v.issues[0]?.tip.severity).toBe('crit');
  });

  it('is watch on a warning finding', () => {
    const v = verdictOf(snapshot([vm()], { crit: 0, warn: 1 }));
    expect(v.level).toBe('watch');
    expect(v.issues.map((i) => i.text)).toEqual(['1 warning finding']);
  });

  it('is watch when a workload is starting', () => {
    const v = verdictOf(snapshot([vm({ workloads: [site('a', 'starting')] })]));
    expect(v.level).toBe('watch');
    expect(v.workloadsHealthy).toBe(0);
    expect(v.issues[0]).toMatchObject({ text: 'a starting', severity: 'warn' });
  });

  it('is watch when a VM is stressed', () => {
    const v = verdictOf(snapshot([vm({ cpu: 95 })]));
    expect(v.level).toBe('watch');
    expect(v.issues[0]).toMatchObject({ text: 'sls-compute is stressed', severity: 'warn' });
  });

  it('is watch when a workload is swamped', () => {
    const v = verdictOf(snapshot([vm({ workloads: [site('a', 'healthy', { mem: 95 })] })]));
    expect(v.level).toBe('watch');
    expect(v.issues[0]?.text).toBe('a is swamped');
  });

  it('is watch when a ci-pod is stressed, and counts pods apart from workloads', () => {
    const pod: Workload = { kind: 'ci-pod', id: 'pod1', cpu: 95, mem: 20 };
    const v = verdictOf(snapshot([vm({ role: 'ci', workloads: [pod, site('a')] })]));
    expect(v).toMatchObject({ level: 'watch', pods: 1, workloadsTotal: 1, workloadsHealthy: 1 });
  });

  it('lists crit before warn', () => {
    const v = verdictOf(
      snapshot([vm({ workloads: [site('slow', 'starting'), site('broken', 'down')] })], { crit: 0, warn: 1 }),
    );
    expect(v.issues.map((i) => i.severity)).toEqual(['crit', 'warn', 'warn']);
    expect(v.issues[0]?.text).toBe('broken down');
  });

  it('handles no VMs at all', () => {
    expect(verdictOf(snapshot([]))).toMatchObject({
      level: 'ok',
      vmsUp: 0,
      vmsTotal: 0,
      workloadsTotal: 0,
      pods: 0,
      issues: [],
    });
  });

  it('handles a VM with no workloads', () => {
    expect(verdictOf(snapshot([vm()]))).toMatchObject({ level: 'ok', vmsUp: 1, vmsTotal: 1, workloadsTotal: 0 });
  });

  it('counts and lists a 13th site instance that has no Place', () => {
    const workloads = Array.from({ length: 13 }, (_, i) => site(`site-${i + 1}`, i === 12 ? 'unhealthy' : 'healthy'));
    const v = verdictOf(snapshot([vm({ workloads })]));
    expect(v.workloadsTotal).toBe(13);
    expect(v.workloadsHealthy).toBe(12);
    expect(v.level).toBe('trouble');
    expect(v.issues.map((i) => i.text)).toEqual(['site-13 unhealthy']);
  });

  it('is calm for the all-working fixture', () => {
    expect(verdictOf(loadFixture('snapshot.all-working.json')).level).not.toBe('trouble');
  });
});
