import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { expect } from 'vitest';
import { generateSnapshotSchema } from '../../scripts/snapshot-schema.ts';
import type { LabEvent, Snapshot, Vm, Workload } from '../../src/contract/snapshot.ts';
import { Simulator } from '../../src/simulator/simulator.ts';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(generateSnapshotSchema());

/** Fails the test unless `snapshot` satisfies the generated Snapshot schema. */
export function expectValid(snapshot: Snapshot): Snapshot {
  expect(validate(snapshot), JSON.stringify(validate.errors)).toBe(true);
  return snapshot;
}

/** Fetches from a source and validates the result; a null fetch fails the test. */
export async function fetched(source: { fetch(): Promise<Snapshot | null> }): Promise<Snapshot> {
  const snapshot = await source.fetch();
  if (snapshot === null) throw new Error('fetch returned null');
  return expectValid(snapshot);
}

export const START = new Date('2026-03-01T10:00:00.000Z');

/**
 * A Simulator with a controllable `random` and wall clock. `random` defaults to a high constant, so
 * rate checks (pods starting by themselves, random OOMs) never fire and picks take the last candidate.
 */
export class Lab {
  readonly events: LabEvent[] = [];
  private value = 0.99;
  private wallMs = START.getTime();
  readonly sim = new Simulator({ random: () => this.value, now: () => new Date(this.wallMs) });

  setRandom(value: number): void {
    this.value = value;
  }

  setWall(offsetSeconds: number): void {
    this.wallMs = START.getTime() + offsetSeconds * 1000;
  }

  /** Advances the model, validates the snapshot and collects its events. */
  advance(seconds: number): Snapshot {
    this.sim.advance(seconds);
    return this.read();
  }

  read(): Snapshot {
    const snapshot = expectValid(this.sim.snapshot());
    this.events.push(...snapshot.events);
    return snapshot;
  }

  /** Seconds after START that an event happened, from its `at`. */
  static secondsOf(event: LabEvent): number {
    return (Date.parse(event.at) - START.getTime()) / 1000;
  }
}

export function vmOf(snapshot: Snapshot, id: string): Vm {
  const vm = snapshot.vms.find((candidate) => candidate.id === id);
  if (vm === undefined) throw new Error(`No VM ${id}`);
  return vm;
}

export function workloadOf(snapshot: Snapshot, id: string): Workload {
  for (const vm of snapshot.vms) {
    const found = vm.workloads.find((workload) => workload.id === id);
    if (found !== undefined) return found;
  }
  throw new Error(`No workload ${id}`);
}

export function healthOf(snapshot: Snapshot, id: string): string {
  const workload = workloadOf(snapshot, id);
  if (!('health' in workload)) throw new Error(`${id} has no health`);
  return workload.health;
}

export function podIds(snapshot: Snapshot): string[] {
  return vmOf(snapshot, 'sls-ci').workloads.map((workload) => workload.id);
}

/** A compact `kind:phase` label per event, for readable assertions. */
export function labels(events: readonly LabEvent[]): string[] {
  return events.map((event) => ('phase' in event ? `${event.kind}:${event.phase}` : event.kind));
}
