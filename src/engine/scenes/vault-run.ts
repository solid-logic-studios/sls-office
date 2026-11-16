import { assertNever } from '../../assert-never.ts';
import type { BackupEvent } from '../../contract/snapshot.ts';
import type { Spot } from '../../contract/theme.ts';
import type { Character } from '../characters/character.ts';
import type { World } from '../world.ts';
import { Scene, type Script } from './scene.ts';

export type Outcome = Exclude<BackupEvent['phase'], 'started'>;

/** The keeper gives up waiting at the vault after this long. */
export const VAULT_TIMEOUT_SECONDS = 60;
const RUN_SPEED = 46;
const LOAD_SECONDS = 0.7;
const HAND_OVER_SECONDS = 1.3;
const LINGER_SECONDS = 0.9;
const MARK_LIFT = 30;

interface VaultCrew {
  keeper: Character;
}

/** The nightly backup: the keeper wheels a strongbox from the stores to the vault and waits for the outcome. */
export class VaultRun extends Scene<VaultCrew> {
  private outcome: Outcome | null;

  constructor(world: World, outcome: Outcome | null = null) {
    super(world);
    this.outcome = outcome;
  }

  get decided(): boolean {
    return this.outcome !== null;
  }

  decide(outcome: Outcome): void {
    this.outcome ??= outcome;
  }

  protected cast(): VaultCrew | null {
    const keeper = this.world.cast.lead('keeper');
    return keeper === undefined ? null : { keeper };
  }

  protected members(crew: VaultCrew): readonly Character[] {
    return [crew.keeper];
  }

  protected *enter({ keeper }: VaultCrew): Script {
    keeper.sceneStatus = 'backing-up';
    keeper.sayCue('backup-start', true);
    const store = this.nearestStore(keeper);
    if (store !== null) yield* this.walk(keeper, store, RUN_SPEED);
  }

  protected *act({ keeper }: VaultCrew): Script {
    keeper.trolley = 'strongbox';
    yield* this.pause(LOAD_SECONDS);
    keeper.sayCue('backup-locked', true);
    yield* this.walk(keeper, this.world.theme.layout.vault, RUN_SPEED);
    keeper.face(1);
    this.world.setPieces.vaultOpen = true;
    const arrived = this.world.now;
    yield () => {
      const waited = this.world.now - arrived;
      return (waited >= HAND_OVER_SECONDS && this.outcome !== null) || waited >= VAULT_TIMEOUT_SECONDS;
    };
  }

  protected *resolve({ keeper }: VaultCrew): Script {
    keeper.trolley = null;
    const { effects } = this.world;
    switch (this.outcome) {
      case 'finished':
        keeper.sayCue('backup-safe', true);
        effects.mark('tick', keeper.x - 2, keeper.y - MARK_LIFT);
        break;
      case 'failed':
        keeper.sayCue('backup-failed', true);
        effects.mark('cross', keeper.x - 2, keeper.y - MARK_LIFT);
        break;
      case null:
        break;
      default:
        return assertNever(this.outcome, 'outcome');
    }
    yield* this.pause(LINGER_SECONDS);
    this.world.setPieces.vaultOpen = false;
  }

  protected override *exit({ keeper }: VaultCrew): Script {
    yield* this.walkHome(keeper, RUN_SPEED);
  }

  protected override onAbort(): void {
    this.world.setPieces.vaultOpen = false;
    this.world.bus.publish({ kind: 'log', text: "Backup run abandoned: the keeper's VM went down" });
  }

  /** The store on the keeper's floor nearest to it, else the nearest on any floor. */
  private nearestStore(keeper: Character): Spot | null {
    const distance = (spot: Spot): number => Math.abs(spot.floor - keeper.floor) * 10_000 + Math.abs(spot.x - keeper.x);
    const stores = [...this.world.theme.layout.stores].sort((a, b) => distance(a) - distance(b));
    return stores[0] ?? null;
  }
}
