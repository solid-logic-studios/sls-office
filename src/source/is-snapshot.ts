import { SNAPSHOT_VERSION, type Snapshot, type Vm } from '../contract/snapshot.ts';

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVm(value: unknown): value is Vm {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.up === 'boolean' &&
    typeof value.cpu === 'number' &&
    typeof value.mem === 'number' &&
    typeof value.role === 'string' &&
    Array.isArray(value.workloads)
  );
}

/**
 * Lightweight runtime guard for the browser: top-level shape and the VM fields the page reads,
 * checked shallowly. Deliberately NOT checked: numeric ranges, enum values, workload and event
 * internals, host internals. That is the generated JSON Schema's job (ajv is not shipped to the browser).
 */
export function isSnapshot(value: unknown): value is Snapshot {
  return (
    isRecord(value) &&
    value.v === SNAPSHOT_VERSION &&
    typeof value.at === 'string' &&
    isRecord(value.host) &&
    Array.isArray(value.events) &&
    Array.isArray(value.vms) &&
    value.vms.every(isVm)
  );
}
