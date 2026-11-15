import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Snapshot } from '../src/contract/snapshot.ts';

export function readFixtureJson(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8');
}

export function loadFixture(name: string): Snapshot {
  return JSON.parse(readFixtureJson(name)) as Snapshot;
}

export const VALID_FIXTURES = ['snapshot.sample.json', 'snapshot.all-working.json'] as const;
