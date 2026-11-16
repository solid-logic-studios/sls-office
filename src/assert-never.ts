/** For the default branch of an exhaustive switch: a compile error if a case is missed, a clear throw if bad data arrives. */
export function assertNever(value: never, what = 'value'): never {
  throw new Error(`Unknown ${what} ${String(value)}`);
}
