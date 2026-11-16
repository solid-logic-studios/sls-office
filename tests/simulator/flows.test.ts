import { describe, expect, it } from 'vitest';
import { Lab, healthOf, labels, podIds, vmOf, workloadOf } from './harness.ts';

// With the harness's default random (0.99) every pick takes the last candidate:
// the last site instance, or the last VM that is up (sls-ci).
const LAST_SITE = 'lab-test-api-develop';

const secondsOf = (lab: Lab) => lab.events.map(Lab.secondsOf);

describe('deploy', () => {
  it('starts, then ends 9 s on for the same subject', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    lab.advance(8.75);
    expect(labels(lab.events)).toEqual(['deploy:started']);
    lab.advance(0.25);
    expect(labels(lab.events)).toEqual(['deploy:started', 'deploy:healthy']);
    expect(lab.events.map((e) => ('subject' in e ? e.subject : ''))).toEqual([LAST_SITE, LAST_SITE]);
    expect(secondsOf(lab)).toEqual([0, 9]);
  });

  it('adds load to sls-deploy while it runs', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    const busy = vmOf(lab.advance(6), 'sls-deploy');
    expect(busy.cpu).toBeGreaterThan(50);
    expect(vmOf(lab.advance(20), 'sls-deploy').cpu).toBeLessThan(25);
  });

  it('emits rolled-back for a deploy that fails its health check', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'deploy', outcome: 'rolled-back' });
    lab.advance(9);
    expect(labels(lab.events)).toEqual(['deploy:started', 'deploy:rolled-back']);
  });

  it('queues a deploy dispatched while one runs and starts it 1 s after the first ends', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    lab.advance(4);
    lab.sim.dispatch({ kind: 'deploy', outcome: 'rolled-back' });
    lab.advance(5);
    expect(labels(lab.events)).toEqual(['deploy:started', 'deploy:healthy']);
    lab.advance(0.75);
    expect(lab.events).toHaveLength(2);
    lab.advance(0.25);
    expect(labels(lab.events)).toEqual(['deploy:started', 'deploy:healthy', 'deploy:started']);
    lab.advance(9);
    expect(labels(lab.events)).toEqual(['deploy:started', 'deploy:healthy', 'deploy:started', 'deploy:rolled-back']);
    expect(secondsOf(lab)).toEqual([0, 9, 10, 19]);
  });

  it('is refused silently when sls-deploy is down', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-deploy', up: false });
    lab.read();
    lab.events.length = 0;
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    lab.advance(20);
    expect(lab.events).toEqual([]);
  });

  it('rolls back at once, and clears the queue, when sls-compute goes down mid-deploy', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    lab.advance(3);
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-compute', up: false });
    lab.advance(0);
    expect(labels(lab.events)).toEqual(['deploy:started', 'vm-down', 'deploy:rolled-back']);
    expect(lab.events[2]).toMatchObject({ subject: LAST_SITE });
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-compute', up: true });
    lab.advance(30);
    expect(labels(lab.events)).toEqual(['deploy:started', 'vm-down', 'deploy:rolled-back', 'vm-up']);
  });

  it('rolls back when sls-deploy goes down mid-deploy', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'deploy', outcome: 'healthy' });
    lab.advance(2);
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-deploy', up: false });
    lab.advance(15);
    expect(labels(lab.events)).toEqual(['deploy:started', 'vm-down', 'deploy:rolled-back']);
  });

  it('runs the deploy-day preset as a healthy deploy then a queued rollback', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'preset', preset: 'deploy' });
    lab.advance(20);
    expect(labels(lab.events)).toEqual(['deploy:started', 'deploy:healthy', 'deploy:started', 'deploy:rolled-back']);
  });
});

describe('CI burst', () => {
  it('fills every free slot, never exceeds three pods, and clears them all by 12 s', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'ci-burst' });
    let most = 0;
    for (let step = 0; step < 52; step++) most = Math.max(most, podIds(lab.advance(0.25)).length);
    expect(most).toBe(3);
    expect(podIds(lab.read())).toEqual([]);
  });

  it('adds pods half a second apart and loads sls-ci', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'ci-burst' });
    expect(podIds(lab.advance(0.25))).toEqual(['ci-pod-1']);
    expect(podIds(lab.advance(0.5))).toEqual(['ci-pod-1', 'ci-pod-2']);
    expect(podIds(lab.advance(0.5))).toEqual(['ci-pod-1', 'ci-pod-2', 'ci-pod-3']);
    expect(vmOf(lab.advance(5), 'sls-ci').cpu).toBeGreaterThan(80);
  });

  it('never reuses a pod id', () => {
    const lab = new Lab();
    const seen: string[] = [];
    for (let burst = 0; burst < 3; burst++) {
      lab.sim.dispatch({ kind: 'ci-burst' });
      for (let step = 0; step < 52; step++) seen.push(...podIds(lab.advance(0.25)));
    }
    const distinct = new Set(seen);
    expect(distinct.size).toBe(9);
    expect([...distinct]).toEqual([
      'ci-pod-1',
      'ci-pod-2',
      'ci-pod-3',
      'ci-pod-4',
      'ci-pod-5',
      'ci-pod-6',
      'ci-pod-7',
      'ci-pod-8',
      'ci-pod-9',
    ]);
  });

  it('starts pods on its own when the random roll is low', () => {
    const lab = new Lab();
    lab.setRandom(0);
    expect(podIds(lab.advance(0.25))).toHaveLength(1);
  });

  it('does nothing when sls-ci is down, and drops its pods when it goes down', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'ci-burst' });
    lab.advance(2);
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-ci', up: false });
    expect(vmOf(lab.advance(0.25), 'sls-ci')).toMatchObject({ up: false, workloads: [] });
    lab.sim.dispatch({ kind: 'ci-burst' });
    expect(vmOf(lab.advance(5), 'sls-ci').workloads).toEqual([]);
  });
});

describe('OOM', () => {
  it('kills a healthy site instance, which restarts healthy 4.5 s later', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'oom' });
    const killed = lab.advance(0.25);
    expect(lab.events).toMatchObject([{ kind: 'oom', subject: LAST_SITE }]);
    expect(healthOf(killed, LAST_SITE)).toBe('starting');
    expect(workloadOf(killed, LAST_SITE)).toMatchObject({ cpu: 0 });
    expect(healthOf(lab.advance(4), LAST_SITE)).toBe('starting');
    const back = lab.advance(0.25);
    expect(healthOf(back, LAST_SITE)).toBe('healthy');
    // It restarts at 30% and has had one 0.25 s step towards its normal level since.
    const { mem } = workloadOf(back, LAST_SITE);
    expect(mem).toBeGreaterThan(29);
    expect(mem).toBeLessThan(36);
  });

  it('prefers a production instance in the everything-is-on-fire preset, 1.5 s in', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'preset', preset: 'fire' });
    lab.advance(1.25);
    expect(lab.events).toEqual([]);
    lab.advance(0.25);
    expect(lab.events).toMatchObject([{ kind: 'oom', subject: 'forms-api-api-production' }]);
  });

  it('happens by itself to a site instance whose memory passes 95', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'preset', preset: 'fire' });
    lab.advance(60);
    lab.setRandom(0);
    lab.advance(0.25);
    expect(lab.events.filter((e) => e.kind === 'oom').length).toBeGreaterThan(1);
  });

  it('does nothing while sls-compute is down', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-compute', up: false });
    lab.sim.dispatch({ kind: 'oom' });
    lab.advance(10);
    expect(labels(lab.events)).toEqual(['vm-down']);
  });
});

describe('VM down', () => {
  it('takes a VM down, reports it with no workloads, and brings it back 14 s later', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'ci-burst' });
    lab.advance(2);
    lab.sim.dispatch({ kind: 'vm-down' });
    const down = lab.advance(0.25);
    expect(lab.events).toMatchObject([{ kind: 'vm-down', subject: 'sls-ci' }]);
    expect(vmOf(down, 'sls-ci')).toMatchObject({ up: false, cpu: 0, mem: 0, workloads: [] });
    lab.advance(13.5);
    expect(lab.events).toHaveLength(1);
    expect(vmOf(lab.advance(0.25), 'sls-ci').up).toBe(true);
    expect(lab.events).toMatchObject([
      { kind: 'vm-down', subject: 'sls-ci' },
      { kind: 'vm-up', subject: 'sls-ci' },
    ]);
    expect(secondsOf(lab)).toEqual([2, 16]);
  });

  it('does not bring back a VM that was taken down by hand', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-ci', up: false });
    lab.advance(60);
    expect(vmOf(lab.read(), 'sls-ci').up).toBe(false);
  });

  it('cancels the automatic return when the VM is brought up by hand first', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'vm-down' });
    lab.advance(2);
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-ci', up: true });
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-ci', up: false });
    lab.advance(30);
    expect(vmOf(lab.read(), 'sls-ci').up).toBe(false);
  });

  it('picks only among VMs that are up', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-ci', up: false });
    lab.sim.dispatch({ kind: 'vm-down' });
    lab.advance(0.25);
    expect(lab.events).toMatchObject([
      { kind: 'vm-down', subject: 'sls-ci' },
      { kind: 'vm-down', subject: 'sls-deploy' },
    ]);
  });
});

describe('backup', () => {
  it('starts, loads sls-data, and finishes 12 s on', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'backup' });
    const running = lab.advance(6);
    expect(vmOf(running, 'sls-data').cpu).toBeGreaterThan(65);
    lab.advance(5.75);
    expect(labels(lab.events)).toEqual(['backup:started']);
    lab.advance(0.25);
    expect(labels(lab.events)).toEqual(['backup:started', 'backup:finished']);
    expect(secondsOf(lab)).toEqual([0, 12]);
  });

  it('does nothing when a backup is already running', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'backup' });
    lab.advance(3);
    lab.sim.dispatch({ kind: 'backup' });
    lab.advance(20);
    expect(labels(lab.events)).toEqual(['backup:started', 'backup:finished']);
  });

  it('fails when sls-data is down', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-data', up: false });
    lab.sim.dispatch({ kind: 'backup' });
    lab.advance(15);
    expect(labels(lab.events)).toEqual(['vm-down', 'backup:failed']);
  });

  it('fails when sls-data goes down mid-run, and never finishes', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'backup' });
    lab.advance(4);
    lab.sim.dispatch({ kind: 'set-up', vmId: 'sls-data', up: false });
    lab.advance(20);
    expect(labels(lab.events)).toEqual(['backup:started', 'vm-down', 'backup:failed']);
  });

  it('runs again after it has finished', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'backup' });
    lab.advance(13);
    lab.sim.dispatch({ kind: 'backup' });
    lab.advance(13);
    expect(labels(lab.events)).toEqual(['backup:started', 'backup:finished', 'backup:started', 'backup:finished']);
  });

  it('runs from the 02:30 backup preset', () => {
    const lab = new Lab();
    lab.sim.dispatch({ kind: 'preset', preset: 'backup' });
    lab.advance(12);
    expect(labels(lab.events)).toEqual(['backup:started', 'backup:finished']);
  });
});
