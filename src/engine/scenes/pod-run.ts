import type { Character } from '../characters/character.ts';
import type { World } from '../world.ts';
import { Scene, type Script } from './scene.ts';

interface PodCrew {
  pod: Character;
}

/** A CI pod's whole life: it appears at the spawn point, runs to its bench, works until its job is done, and goes. */
export class PodRun extends Scene<PodCrew> {
  constructor(
    world: World,
    private readonly pod: Character,
  ) {
    super(world);
  }

  /** A pod leaving the lab is how this scene ends, not a reason to abort it. */
  override get broken(): boolean {
    return !this.pod.present;
  }

  protected cast(): PodCrew | null {
    return this.pod.present && !this.pod.retiring ? { pod: this.pod } : null;
  }

  protected members(crew: PodCrew): readonly Character[] {
    return [crew.pod];
  }

  protected *enter({ pod }: PodCrew): Script {
    pod.teleport(this.world.theme.layout.podSpawn);
    pod.appear();
    yield* this.walkHome(pod);
  }

  protected *act({ pod }: PodCrew): Script {
    yield () => pod.retiring;
  }

  /** Released, the retired pod ticks, puffs and goes of its own accord. */
  protected *resolve({ pod }: PodCrew): Script {
    this.release(pod);
    const wrangler = this.world.cast.lead('wrangler');
    if (wrangler !== undefined && this.world.random.chance(0.4)) wrangler.sayCue('pod-done');
  }
}
