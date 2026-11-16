import {
  SNAPSHOT_VERSION,
  type Host,
  type LabEvent,
  type Snapshot,
  type Vm,
  type Workload,
} from '../contract/snapshot.ts';

type Loose = Record<string, unknown>;

const VM_ROLES: readonly unknown[] = ['data', 'compute', 'deploy', 'ci'];
const SITE_ENVS: readonly unknown[] = ['develop', 'staging', 'production'];
const SERVICE_KINDS: readonly unknown[] = ['platform', 'engine', 'runner'];
const DEPLOY_PHASES: readonly unknown[] = ['started', 'healthy', 'rolled-back'];
const BACKUP_PHASES: readonly unknown[] = ['started', 'finished', 'failed'];
const FAULT_KINDS: readonly unknown[] = ['oom', 'vm-down', 'vm-up'];

function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isHost(value: unknown): value is Host {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isNumber(value.cpu) &&
    isNumber(value.mem) &&
    isRecord(value.findings) &&
    isNumber(value.findings.ok) &&
    isNumber(value.findings.warn) &&
    isNumber(value.findings.crit)
  );
}

function isWorkload(value: unknown): value is Workload {
  if (!isRecord(value) || !isString(value.id) || !isNumber(value.cpu) || !isNumber(value.mem)) return false;
  if (value.kind === 'ci-pod') return true;
  if (value.kind === 'site-instance') {
    return (
      isString(value.client) &&
      isString(value.site) &&
      isString(value.siteType) &&
      isString(value.health) &&
      SITE_ENVS.includes(value.env)
    );
  }
  return SERVICE_KINDS.includes(value.kind) && isString(value.name) && isString(value.health);
}

function isVm(value: unknown): value is Vm {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    typeof value.up === 'boolean' &&
    isNumber(value.cpu) &&
    isNumber(value.mem) &&
    VM_ROLES.includes(value.role) &&
    Array.isArray(value.workloads) &&
    value.workloads.every(isWorkload)
  );
}

function isEvent(value: unknown): value is LabEvent {
  if (!isRecord(value) || !isString(value.at)) return false;
  if (value.kind === 'deploy') return DEPLOY_PHASES.includes(value.phase) && isString(value.subject);
  if (value.kind === 'backup') return BACKUP_PHASES.includes(value.phase);
  return FAULT_KINDS.includes(value.kind) && isString(value.subject);
}

/**
 * Lightweight runtime guard for the browser. It checks the structure the Engine and the Themes read:
 * the top-level shape, the host and its findings, every VM and its role, every workload by kind, and
 * every event by kind. Deliberately NOT checked: numeric ranges, the `health` vocabulary, timestamp
 * formats and extra properties. That is the generated JSON Schema's job (ajv is not shipped to the browser).
 */
export function isSnapshot(value: unknown): value is Snapshot {
  return (
    isRecord(value) &&
    value.v === SNAPSHOT_VERSION &&
    isString(value.at) &&
    isHost(value.host) &&
    Array.isArray(value.events) &&
    value.events.every(isEvent) &&
    Array.isArray(value.vms) &&
    value.vms.every(isVm)
  );
}
