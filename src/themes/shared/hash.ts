/** Stable, dependency-free hashing, so the same workload always gets the same face. */

/** FNV-1a over the UTF-16 code units. */
export function hashOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/** Folds a salt into a hash, so one hash can drive several independent choices. */
export function mix(h: number, salt: number): number {
  let x = (h + Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return x >>> 0;
}

export type NonEmpty<T> = readonly [T, ...T[]];

export function pick<T>(list: NonEmpty<T>, h: number, salt = 0): T {
  return list[mix(h, salt) % list.length] ?? list[0];
}
