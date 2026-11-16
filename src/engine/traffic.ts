import type { Character } from './characters/character.ts';
import { QueryRun } from './scenes/query.ts';
import type { Director } from './scenes/director.ts';
import type { World } from './world.ts';

export const MAX_VISITORS = 3;

/** Visitors and queries per second, both rising with the compute VM's cpu (as in the prototype). */
const VISITOR_BASE_RATE = 0.04;
const VISITOR_LOAD_RATE = 0.55;
const QUERY_BASE_RATE = 0.08;
const QUERY_LOAD_RATE = 0.7;

/** Ambient comings and goings: visitors to the workers, and query papers to the keeper. */
export class Traffic {
  constructor(
    private readonly world: World,
    private readonly director: Director,
  ) {}

  update(dt: number): void {
    const compute = this.world.vms.find((vm) => vm.role === 'compute');
    if (compute === undefined || !compute.up) return;
    const load = compute.cpu / 100;
    const { random } = this.world;
    if (random.chance(dt * (VISITOR_BASE_RATE + load * VISITOR_LOAD_RATE))) this.sendVisitor();
    if (random.chance(dt * (QUERY_BASE_RATE + load * QUERY_LOAD_RATE))) this.sendQuery();
  }

  private sendVisitor(): void {
    const { cast, random } = this.world;
    if (cast.visitorCount() >= MAX_VISITORS) return;
    const target = random.pick(cast.availableWorkers());
    if (target === undefined) return;
    cast.addVisitor(target, this.hosts());
  }

  private sendQuery(): void {
    const asker = this.world.random.pick(this.world.cast.availableWorkers());
    if (asker !== undefined) this.director.tryNow(new QueryRun(this.world, asker));
  }

  /** Whoever a visitor stops by on the way in: the guards, then the greeter. */
  private hosts(): readonly Character[] {
    const { cast } = this.world;
    const ready = (character: Character): boolean => character.visible && !character.held && character.atHome;
    return [...cast.ofPart('guard'), ...cast.ofPart('greeter')].filter(ready);
  }
}
