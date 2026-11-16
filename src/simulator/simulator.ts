import {
  SNAPSHOT_VERSION,
  type BackupEvent,
  type DeployEvent,
  type FaultEvent,
  type LabEvent,
  type Snapshot,
} from '../contract/snapshot.ts';
import type { SnapshotSource } from '../source/snapshot-source.ts';
import { CiPod } from './ci-pod.ts';
import type { PresetId, SimCommand, VmControl } from './commands.ts';
import type { GuestVm } from './guest-vm.ts';
import { LabModel, MAX_CI_PODS } from './lab-model.ts';
import { PRESET_LOADS } from './presets.ts';
import type { SiteInstance } from './site-instance.ts';
import { type Cancel, Timeline } from './timeline.ts';
import { assertNever, pick } from './util.ts';

export type { PresetId, SimCommand, VmControl } from './commands.ts';
export { PRESET_IDS, PRESET_NAMES } from './presets.ts';

const STEP_SECONDS = 0.25;
const MAX_FETCH_SECONDS = 5;
const DEPLOY_SECONDS = 9;
const DEPLOY_GAP_SECONDS = 1;
const BACKUP_SECONDS = 12;
const OOM_RESTART_SECONDS = 4.5;
const VM_DOWN_SECONDS = 14;
const POD_SPACING_SECONDS = 0.5;
const POD_MIN_SECONDS = 6;
const POD_SPREAD_SECONDS = 5;
const FIRE_OOM_DELAY_SECONDS = 1.5;
/** Per second chances, scaled by the step length. */
const SELF_OOM_RATE = 0.07;
const SELF_POD_RATE = 0.22;
const SELF_OOM_MEM = 95;

type DeployOutcome = 'healthy' | 'rolled-back';

interface RunningDeploy {
  subject: string;
  outcome: DeployOutcome;
  cancel: Cancel;
}

export interface SimulatorOptions {
  random?: () => number;
  now?: () => Date;
}

/** A synthetic lab. Drive it with commands, step it with time, read it as Snapshots. */
export class Simulator implements SnapshotSource {
  private readonly random: () => number;
  private readonly wallClock: () => Date;
  private readonly timeline = new Timeline();
  private readonly model: LabModel;
  private epochMs: number;
  private lastFetchMs: number | null = null;
  private events: LabEvent[] = [];
  private deploy: RunningDeploy | null = null;
  private readonly deployQueue: DeployOutcome[] = [];
  private cancelBackup: Cancel | null = null;
  private readonly returnTimers = new Map<GuestVm, Cancel>();
  private podCount = 0;

  constructor({ random = Math.random, now = () => new Date() }: SimulatorOptions = {}) {
    this.random = random;
    this.wallClock = now;
    this.epochMs = now().getTime();
    this.model = new LabModel(random);
  }

  dispatch(command: SimCommand): void {
    switch (command.kind) {
      case 'preset':
        return this.applyPreset(command.preset);
      case 'deploy':
        return this.requestDeploy(command.outcome);
      case 'ci-burst':
        return this.ciBurst();
      case 'backup':
        return this.startBackup();
      case 'oom':
        return this.oomRandom(false);
      case 'vm-down':
        return this.vmDownRandom();
      case 'set-load':
        return this.guest(command.vmId)?.setLoad(command.cpu, command.mem);
      case 'set-up': {
        const guest = this.guest(command.vmId);
        if (guest !== undefined) this.setVmUp(guest, command.up);
        return;
      }
      default:
        return assertNever(command);
    }
  }

  /** Steps in slices of at most STEP_SECONDS so the result does not depend on how often this is called. */
  advance(seconds: number): void {
    for (let left = seconds; left > 0; left -= STEP_SECONDS) {
      const dt = Math.min(STEP_SECONDS, left);
      const time = this.timeline.now + dt;
      this.timeline.advanceTo(time);
      this.model.step(time, dt);
      this.backgroundChances(dt);
    }
  }

  /** The lab now, plus the events since the previous call. */
  snapshot(): Snapshot {
    const events = this.events;
    this.events = [];
    return {
      v: SNAPSHOT_VERSION,
      at: this.stamp(),
      host: this.model.host(),
      vms: this.model.vms(this.timeline.now),
      events,
    };
  }

  async fetch(): Promise<Snapshot | null> {
    const wallMs = this.wallClock().getTime();
    const elapsed = this.lastFetchMs === null ? 0 : Math.max(0, (wallMs - this.lastFetchMs) / 1000);
    this.lastFetchMs = wallMs;
    const stepped = Math.min(elapsed, MAX_FETCH_SECONDS);
    // Time we skip (a hidden tab, say) is pushed into the epoch so Snapshot `at` keeps tracking the wall clock.
    this.epochMs += (elapsed - stepped) * 1000;
    this.advance(stepped);
    return this.snapshot();
  }

  controls(): readonly VmControl[] {
    return this.model.guests.map((guest) => ({
      id: guest.id,
      name: guest.id,
      cpu: guest.targetCpu,
      mem: guest.targetMem,
      up: guest.up,
    }));
  }

  private guest(id: string): GuestVm | undefined {
    return this.model.guests.find((guest) => guest.id === id);
  }

  private stamp(): string {
    return new Date(this.epochMs + this.timeline.now * 1000).toISOString();
  }

  private after(seconds: number, run: () => void): Cancel {
    return this.timeline.after(seconds, run);
  }

  private deployEvent(phase: DeployEvent['phase'], subject: string): void {
    this.events.push({ kind: 'deploy', phase, subject, at: this.stamp() });
  }

  private backupEvent(phase: BackupEvent['phase']): void {
    this.events.push({ kind: 'backup', phase, at: this.stamp() });
  }

  private faultEvent(kind: FaultEvent['kind'], subject: string): void {
    this.events.push({ kind, subject, at: this.stamp() });
  }

  /** Things that happen on their own at a rate: pods starting, memory-hungry sites falling over. */
  private backgroundChances(dt: number): void {
    const { model, random } = this;
    for (const site of model.sites) {
      if (site.mem > SELF_OOM_MEM && random() < dt * SELF_OOM_RATE) this.oom(site);
    }
    if (model.ci.up && random() < ((dt * model.ci.targetCpu) / 100) * SELF_POD_RATE) this.spawnPod();
  }

  private applyPreset(preset: PresetId): void {
    const { model } = this;
    for (const guest of model.guests) this.setVmUp(guest, true);
    for (const site of model.sites) site.heal();
    const loads = PRESET_LOADS[preset];
    for (const guest of model.guests) {
      const load = loads[guest.role];
      guest.setLoad(load.cpu, load.mem);
    }
    switch (preset) {
      case 'quiet':
      case 'arvo':
        return;
      case 'deploy':
        this.dispatch({ kind: 'deploy', outcome: 'healthy' });
        this.dispatch({ kind: 'ci-burst' });
        this.dispatch({ kind: 'deploy', outcome: 'rolled-back' });
        return;
      case 'fire':
        this.dispatch({ kind: 'ci-burst' });
        this.after(FIRE_OOM_DELAY_SECONDS, () => this.oomRandom(true));
        return;
      case 'backup':
        this.dispatch({ kind: 'backup' });
        return;
      default:
        return assertNever(preset);
    }
  }

  /** The one place a VM changes state, so the knock-on effects cannot be missed. */
  private setVmUp(guest: GuestVm, up: boolean): void {
    if (guest.up === up) return;
    this.returnTimers.get(guest)?.();
    this.returnTimers.delete(guest);
    guest.setUp(up);
    this.faultEvent(up ? 'vm-up' : 'vm-down', guest.id);
    if (up) return;
    const { model } = this;
    if (guest === model.ci) this.clearPods();
    if (guest === model.data) this.failBackup();
    if (guest === model.deploy || guest === model.compute) this.abortDeploy();
  }

  private vmDownRandom(): void {
    const guest = pick(
      this.model.guests.filter((g) => g.up),
      this.random,
    );
    if (guest === undefined) return;
    this.setVmUp(guest, false);
    this.returnTimers.set(
      guest,
      this.after(VM_DOWN_SECONDS, () => this.setVmUp(guest, true)),
    );
  }

  private requestDeploy(outcome: DeployOutcome): void {
    if (this.deploy !== null) this.deployQueue.push(outcome);
    else this.startDeploy(outcome);
  }

  private startDeploy(outcome: DeployOutcome): void {
    const { model } = this;
    if (!model.deploy.up || !model.compute.up) return;
    const site = pick(
      model.sites.filter((s) => s.isHealthy),
      this.random,
    );
    if (site === undefined) return;
    const subject = site.spec.id;
    this.deployEvent('started', subject);
    model.deploying = true;
    const cancel = this.after(DEPLOY_SECONDS, () => {
      this.deploy = null;
      model.deploying = false;
      this.deployEvent(outcome, subject);
      if (this.deployQueue.length > 0) this.after(DEPLOY_GAP_SECONDS, () => this.startNextDeploy());
    });
    this.deploy = { subject, outcome, cancel };
  }

  /** A queued deploy that is refused (nothing healthy, VM down) is dropped and the next one tried. */
  private startNextDeploy(): void {
    if (this.deploy !== null) return;
    const next = this.deployQueue.shift();
    if (next === undefined) return;
    this.startDeploy(next);
    if (this.deploy === null) this.startNextDeploy();
  }

  private abortDeploy(): void {
    const running = this.deploy;
    this.deployQueue.length = 0;
    if (running === null) return;
    running.cancel();
    this.deploy = null;
    this.model.deploying = false;
    this.deployEvent('rolled-back', running.subject);
  }

  private ciBurst(): void {
    if (!this.model.ci.up) return;
    const free = MAX_CI_PODS - this.model.pods.length;
    for (let slot = 0; slot < free; slot++) this.after(slot * POD_SPACING_SECONDS, () => this.spawnPod());
  }

  private spawnPod(): void {
    const { model, random } = this;
    if (!model.ci.up || model.pods.length >= MAX_CI_PODS) return;
    const pod = new CiPod(`ci-pod-${++this.podCount}`, random() * 6);
    model.pods.push(pod);
    pod.cancelRemoval = this.after(POD_MIN_SECONDS + random() * POD_SPREAD_SECONDS, () => {
      model.pods = model.pods.filter((p) => p !== pod);
    });
  }

  private clearPods(): void {
    for (const pod of this.model.pods) pod.cancelRemoval();
    this.model.pods = [];
  }

  private startBackup(): void {
    const { model } = this;
    if (!model.data.up) {
      this.backupEvent('failed');
      return;
    }
    if (this.cancelBackup !== null) return;
    this.backupEvent('started');
    model.backingUp = true;
    this.cancelBackup = this.after(BACKUP_SECONDS, () => {
      this.cancelBackup = null;
      model.backingUp = false;
      this.backupEvent('finished');
    });
  }

  private failBackup(): void {
    if (this.cancelBackup === null) return;
    this.cancelBackup();
    this.cancelBackup = null;
    this.model.backingUp = false;
    this.backupEvent('failed');
  }

  private oomRandom(preferProduction: boolean): void {
    let candidates = this.model.sites.filter((site) => site.isHealthy);
    const production = candidates.filter((site) => site.spec.env === 'production');
    if (preferProduction && production.length > 0) candidates = production;
    const site = pick(candidates, this.random);
    if (site !== undefined) this.oom(site);
  }

  private oom(site: SiteInstance): void {
    if (!this.model.compute.up || !site.isHealthy) return;
    site.crash();
    this.faultEvent('oom', site.spec.id);
    site.restart = this.after(OOM_RESTART_SECONDS, () => site.recover());
  }
}
