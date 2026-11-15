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
    typeof value.cpu === 'number'
  );
}

/**
 * Lightweight runtime guard for the browser. It checks only what the page relies on; full
 * validation is the generated JSON Schema's job (ajv is not shipped to the browser).
 */
export function isSnapshot(value: unknown): value is Snapshot {
  return (
    isRecord(value) &&
    value.v === SNAPSHOT_VERSION &&
    typeof value.at === 'string' &&
    Array.isArray(value.vms) &&
    value.vms.every(isVm)
  );
}
