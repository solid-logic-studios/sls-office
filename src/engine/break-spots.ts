import type { BreakSpot } from '../contract/theme.ts';
import type { Random } from './random.ts';

export interface Claim {
  index: number;
  spot: BreakSpot;
}

/** Who has claimed which break spot, and who has got there. One taker per spot. */
export class BreakSpots {
  private readonly takers = new Map<number, string>();
  private readonly arrived = new Set<number>();

  constructor(
    private readonly spots: readonly BreakSpot[],
    private readonly random: Random,
  ) {}

  /** A random free spot for `takerId`, or `null` when every spot is taken. */
  claim(takerId: string): Claim | null {
    this.release(takerId);
    const free = this.spots.flatMap((spot, index) => (this.takers.has(index) ? [] : [{ index, spot }]));
    const claim = this.random.pick(free) ?? null;
    if (claim) this.takers.set(claim.index, takerId);
    return claim;
  }

  arrive(index: number): void {
    if (this.takers.has(index)) this.arrived.add(index);
  }

  /** Frees whatever spot `takerId` holds. */
  release(takerId: string): void {
    for (const [index, taker] of this.takers) {
      if (taker !== takerId) continue;
      this.takers.delete(index);
      this.arrived.delete(index);
    }
  }

  /** The spot `takerId` has reached, if any. */
  occupiedBy(takerId: string): BreakSpot | null {
    for (const [index, taker] of this.takers) {
      if (taker === takerId && this.arrived.has(index)) return this.spots[index] ?? null;
    }
    return null;
  }

  get busy(): ReadonlySet<number> {
    return this.arrived;
  }
}
