import type { Character } from '../characters/character.ts';
import { PAPER_SECONDS } from '../effects.ts';
import type { World } from '../world.ts';
import { Scene, type Script } from './scene.ts';

const FETCH_SECONDS = 0.9;
const QUICK_ANSWER_SECONDS = 0.3;

interface QueryCrew {
  keeper: Character;
}

/**
 * Ambient: a worker sends the keeper a query on paper. The keeper answers at once or fetches the
 * records from a store first, then sends the paper back. Only the keeper is held; the asker keeps working.
 */
export class QueryRun extends Scene<QueryCrew> {
  constructor(
    world: World,
    private readonly asker: Character,
  ) {
    super(world);
  }

  protected cast(): QueryCrew | null {
    const keeper = this.world.cast.lead('keeper');
    if (keeper === undefined || !keeper.atHome || !keeper.visible || keeper.mood === 'fainted') return null;
    return { keeper };
  }

  protected members(crew: QueryCrew): readonly Character[] {
    return [crew.keeper];
  }

  protected *enter({ keeper }: QueryCrew): Script {
    if (this.world.random.chance(0.3)) this.asker.sayCue('query');
    this.world.bus.publish({ kind: 'paper', fromId: this.asker.id, toId: keeper.id });
    yield* this.pause(PAPER_SECONDS);
  }

  protected *act({ keeper }: QueryCrew): Script {
    const { random, setPieces, theme } = this.world;
    const stores = theme.layout.stores;
    const index = random.int(stores.length);
    const store = stores[index];
    if (store === undefined || !random.chance(0.6)) {
      yield* this.pause(QUICK_ANSWER_SECONDS);
      return;
    }
    yield* this.walk(keeper, store);
    setPieces.openStores.add(index);
    yield* this.pause(FETCH_SECONDS);
    setPieces.openStores.delete(index);
    yield* this.walkHome(keeper);
  }

  protected *resolve({ keeper }: QueryCrew): Script {
    this.world.bus.publish({ kind: 'paper', fromId: keeper.id, toId: this.asker.id });
    if (this.world.random.chance(0.3)) keeper.sayCue('query-answer');
  }

  protected override onAbort(): void {
    this.world.setPieces.openStores.clear();
  }
}
