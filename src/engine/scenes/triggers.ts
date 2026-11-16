import type { BackupEvent, DeployEvent } from '../../contract/snapshot.ts';
import type { EngineEventOf } from '../events.ts';
import type { World } from '../world.ts';
import { DeployScene } from './deploy.ts';
import type { Director } from './director.ts';
import { PodRun } from './pod-run.ts';
import { VaultRun } from './vault-run.ts';

/**
 * Turns lab events on the bus into scenes for the director. A verdict or outcome goes to the scene
 * waiting for it; with no such scene (its start was missed) it plays a fresh one with the answer known.
 */
export class SceneTriggers {
  private deploys: DeployScene[] = [];
  private vault: VaultRun | null = null;
  private podsAdded = 0;
  private readonly unsubscribe: readonly (() => void)[];

  constructor(
    private readonly world: World,
    private readonly director: Director,
  ) {
    const { bus } = world;
    this.unsubscribe = [
      bus.subscribe('deploy', (event) => this.onDeploy(event)),
      bus.subscribe('backup', (event) => this.onBackup(event)),
      bus.subscribe('workload-added', (event) => this.onWorkloadAdded(event)),
    ];
  }

  /** Called once the events of one Snapshot have all been published. */
  endSnapshot(): void {
    if (this.podsAdded > 0) this.world.cast.lead('wrangler')?.sayCue('pods-up', true);
    this.podsAdded = 0;
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
  }

  private onDeploy(event: DeployEvent): void {
    const { subject } = event;
    if (event.phase === 'started') {
      // Anything older for this subject that has finished can no longer take a verdict.
      this.deploys = this.deploys.filter((scene) => !(scene.subject === subject && scene.finished));
      this.play(new DeployScene(this.world, subject));
      return;
    }
    // The latest unanswered scene takes the verdict, so a new deploy is not starved by an older one whose
    // verdict was lost. A scene that finished without one still takes it, so it is not replayed.
    const waiting = this.deploys.findLast((scene) => scene.subject === subject && !scene.decided);
    if (waiting !== undefined) waiting.decide(event.phase);
    else this.play(new DeployScene(this.world, subject, event.phase));
    this.deploys = this.deploys.filter((scene) => !(scene.finished && scene.decided));
  }

  private play(scene: DeployScene): void {
    this.deploys.push(scene);
    this.director.enqueue(scene);
  }

  private onBackup(event: BackupEvent): void {
    const vault = this.vault;
    if (event.phase === 'started') {
      if (vault !== null && !vault.finished) return;
      this.vault = new VaultRun(this.world);
      this.director.enqueue(this.vault);
      return;
    }
    if (vault !== null && !vault.decided) {
      vault.decide(event.phase);
      return;
    }
    this.vault = new VaultRun(this.world, event.phase);
    this.director.enqueue(this.vault);
  }

  private onWorkloadAdded(event: EngineEventOf<'workload-added'>): void {
    if (event.workload.kind !== 'ci-pod') return;
    this.podsAdded += 1;
    const pod = this.world.cast.forWorkload(event.workload.id);
    if (pod !== undefined) this.director.enqueue(new PodRun(this.world, pod));
  }
}
