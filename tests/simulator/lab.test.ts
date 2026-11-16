import { describe, expect, it } from 'vitest';
import { PRESET_IDS } from '../../src/simulator/presets.ts';
import { Simulator } from '../../src/simulator/simulator.ts';
import { Lab, START, fetched, healthOf, labels, vmOf, workloadOf } from './harness.ts';

describe('the simulated lab', () => {
  it('produces a valid Snapshot straight after construction', () => {
    const snapshot = new Lab().read();
    expect(snapshot.host.name).toBe('pve');
    expect(snapshot.vms.map((vm) => vm.id)).toEqual(['sls-data', 'sls-compute', 'sls-deploy', 'sls-ci']);
    expect(snapshot.at).toBe(START.toISOString());
  });

  it('works with the real clock and Math.random by default', async () => {
    const snapshot = await fetched(new Simulator());
    expect(snapshot.vms).toHaveLength(4);
  });

  it('puts the right workloads on each VM', () => {
    const snapshot = new Lab().read();
    const named = (id: string) => vmOf(snapshot, id).workloads.map((w) => `${w.kind}:${w.id}`);
    const compute = named('sls-compute');
    expect(compute).toHaveLength(16);
    expect(compute.slice(0, 2)).toEqual(['site-instance:scrd-server-develop', 'site-instance:scrd-client-develop']);
    expect(compute.slice(12)).toEqual([
      'platform:traefik',
      'platform:cloudflared-1',
      'platform:cloudflared-2',
      'platform:gatus',
    ]);
    expect(named('sls-data')).toEqual(['engine:postgres', 'engine:mysql']);
    expect(named('sls-deploy')).toEqual([]);
    expect(named('sls-ci')).toEqual([]);
  });

  it('counts the host, four VMs, 12 sites and 4 platform services in the findings', () => {
    const { findings } = new Lab().read().host;
    expect(findings.ok + findings.warn + findings.crit).toBe(21);
    expect(findings.warn).toBeGreaterThanOrEqual(1);
    expect(findings.crit).toBe(0);
  });

  it('counts a down sls-compute as critical: itself, its platform services and the production sites', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-compute', up: false });
    expect(lab.advance(1).host.findings.crit).toBe(1 + 4 + 2);
  });

  it.each(PRESET_IDS)('stays valid for 30 s after the %s preset', (preset) => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'preset', preset });
    lab.read();
    for (let second = 0; second < 30; second++) lab.advance(1);
  });

  it('moves VM cpu towards the preset targets', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'preset', preset: 'fire' });
    expect(lab.sim.controls().find((c) => c.id === 'sls-compute')).toMatchObject({ cpu: 96, mem: 97, up: true });
    const hot = lab.advance(20);
    expect(vmOf(hot, 'sls-compute').cpu).toBeGreaterThan(88);
    expect(vmOf(hot, 'sls-data').cpu).toBeGreaterThan(80);
    lab.sim.dispatch({ kind: 'preset', preset: 'quiet' });
    expect(vmOf(lab.advance(30), 'sls-compute').cpu).toBeLessThan(12);
  });

  it('brings every VM back up and heals every site on a preset', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-data', up: false });
    lab.advance(1);
    lab.sim.dispatch({ kind: 'preset', preset: 'arvo' });
    const snapshot = lab.advance(1);
    expect(snapshot.vms.every((vm) => vm.up)).toBe(true);
    expect(healthOf(snapshot, 'bsra-bsra-production')).toBe('healthy');
    expect(labels(lab.events)).toEqual(['vm-down', 'vm-up']);
  });

  it('lets the sliders set targets and a VM go down and up by hand', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-load', vmId: 'sls-deploy', cpu: 70, mem: 150 });
    expect(lab.sim.controls().find((c) => c.id === 'sls-deploy')).toMatchObject({ cpu: 70, mem: 100 });
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-deploy', up: false });
    expect(vmOf(lab.advance(30), 'sls-deploy')).toMatchObject({ up: false, cpu: 0, mem: 0, workloads: [] });
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-deploy', up: true });
    lab.advance(1);
    expect(labels(lab.events)).toEqual(['vm-down', 'vm-up']);
  });

  it('keeps database-backed site instances unhealthy while sls-data is down, then recovers them', () => {
    const lab = new Lab();
    const databaseBacked = [
      'scrd-server-develop',
      'bsra-bsra-develop',
      'bsra-bsra-staging',
      'bsra-bsra-production',
      'forms-api-api-develop',
      'forms-api-api-production',
      'lab-test-blog-develop',
      'lab-test-api-develop',
    ];
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-data', up: false });
    const down = lab.advance(1);
    for (const id of databaseBacked) expect(healthOf(down, id)).toBe('unhealthy');
    expect(healthOf(down, 'scrd-client-develop')).toBe('healthy');
    expect(workloadOf(down, 'bsra-bsra-production')).toMatchObject({ cpu: 0, mem: 0 });
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-data', up: true });
    const back = lab.advance(1);
    for (const id of databaseBacked) expect(healthOf(back, id)).toBe('healthy');
  });

  it('returns each event exactly once', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-ci', up: false });
    expect(lab.sim.snapshot().events).toHaveLength(1);
    expect(lab.sim.snapshot().events).toEqual([]);
  });

  it('steps in slices of at most 0.25 s however long a single advance is', () => {
    const once = new Lab();
    const sliced = new Lab();
    once.sim.dispatch({ kind: 'preset', preset: 'fire' });
    sliced.sim.dispatch({ kind: 'preset', preset: 'fire' });
    once.sim.advance(10);
    for (let i = 0; i < 40; i++) sliced.sim.advance(0.25);
    expect(sliced.read()).toEqual(once.read());
  });
});

describe('fetch', () => {
  it('advances by the wall time since the last fetch, and not at all on the first', async () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    const first = await fetched(lab.sim);
    expect(labels(first.events)).toEqual(['deploy:started']);
    expect(first.at).toBe(START.toISOString());

    lab.setWall(4);
    const second = await fetched(lab.sim);
    expect(second.at).toBe(new Date(START.getTime() + 4000).toISOString());
    expect(second.events).toEqual([]);

    lab.setWall(9);
    expect(labels((await fetched(lab.sim)).events)).toEqual(['deploy:healthy']);
  });

  it('moves the model by at most 5 s per fetch, yet keeps `at` on the wall clock', async () => {
    const lab = new Lab();
    await fetched(lab.sim);
    lab.sim.dispatch({ kind: 'backup' });
    lab.setWall(3600);
    const capped = await fetched(lab.sim);
    expect(labels(capped.events)).toEqual(['backup:started']);
    expect(capped.at).toBe(new Date(START.getTime() + 3600_000).toISOString());

    // 7 s of wall time but only 5 s of model time: 10 s into a 12 s backup.
    lab.setWall(3607);
    expect((await fetched(lab.sim)).events).toEqual([]);

    lab.setWall(3612);
    expect(labels((await fetched(lab.sim)).events)).toEqual(['backup:finished']);
  });
});
