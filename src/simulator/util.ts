export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** A contract percentage: clamped to 0 to 100 and rounded to one decimal place. */
export function percent(value: number): number {
  return Math.round(clamp(value, 0, 100) * 10) / 10;
}

/** `undefined` when the list is empty. */
export function pick<T>(items: readonly T[], random: () => number): T | undefined {
  return items[Math.floor(random() * items.length)];
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
