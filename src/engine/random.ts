/** A source of numbers from 0 (inclusive) to 1 (exclusive), like `Math.random`. */
export type RandomSource = () => number;

/** Mulberry32: small and fast. The Engine's default, so a run with no injected source is repeatable. */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The Engine's one random source, passed to whoever needs it. */
export class Random {
  constructor(private readonly source: RandomSource) {}

  next(): number {
    return this.source();
  }

  range(min: number, max: number): number {
    return min + this.source() * (max - min);
  }

  /** A whole number from 0 to `count - 1`. */
  int(count: number): number {
    return Math.floor(this.source() * count);
  }

  chance(probability: number): boolean {
    return this.source() < probability;
  }

  /** `undefined` only for an empty list. */
  pick<T>(items: readonly T[] | undefined): T | undefined {
    if (items === undefined || items.length === 0) return undefined;
    return items[this.int(items.length)];
  }
}
