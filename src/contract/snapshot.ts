/**
 * Snapshot contract v1: the single source of truth for the lab state document.
 *
 * The collector writes `snapshot.json` next to `index.html`; the page reads it. The JSON Schema
 * is generated from these types (`pnpm schema`), so edit the types here and nothing else.
 *
 * Conventions:
 * - Every `cpu` and `mem` is a percentage from 0 to 100. `mem` is the percentage of the memory
 *   allocated to that VM (or to the host, for `host.mem`).
 * - Every timestamp is ISO 8601 (RFC 3339 date-time).
 */

/** Version of the snapshot contract this file describes. */
export const SNAPSHOT_VERSION = 1 as const;

/**
 * Percentage, 0 to 100.
 * @minimum 0
 * @maximum 100
 */
export type Percent = number;

/**
 * Non-negative whole number.
 * @asType integer
 * @minimum 0
 */
export type Count = number;

/**
 * ISO 8601 date-time.
 * @format date-time
 */
export type Timestamp = string;

export type Health = 'healthy' | 'starting' | 'unhealthy' | 'down';

export type VmRole = 'data' | 'compute' | 'deploy' | 'ci';

export type SiteEnv = 'develop' | 'staging' | 'production';

export interface Findings {
  ok: Count;
  warn: Count;
  crit: Count;
}

export interface Host {
  name: string;
  cpu: Percent;
  mem: Percent;
  findings: Findings;
}

export interface SiteInstanceWorkload {
  kind: 'site-instance';
  id: string;
  client: string;
  site: string;
  env: SiteEnv;
  siteType: string;
  cpu: Percent;
  mem: Percent;
  health: Health;
}

export interface ServiceWorkload {
  kind: 'platform' | 'engine' | 'runner';
  id: string;
  name: string;
  cpu: Percent;
  mem: Percent;
  health: Health;
}

export interface CiPodWorkload {
  kind: 'ci-pod';
  id: string;
  cpu: Percent;
  mem: Percent;
}

export type Workload = SiteInstanceWorkload | ServiceWorkload | CiPodWorkload;

export interface Vm {
  id: string;
  role: VmRole;
  name: string;
  up: boolean;
  cpu: Percent;
  mem: Percent;
  workloads: Workload[];
}

export interface DeployEvent {
  kind: 'deploy';
  phase: 'started' | 'healthy' | 'rolled-back';
  subject: string;
  at: Timestamp;
}

export interface BackupEvent {
  kind: 'backup';
  phase: 'started' | 'finished' | 'failed';
  at: Timestamp;
}

export interface FaultEvent {
  kind: 'oom' | 'vm-down' | 'vm-up';
  subject: string;
  at: Timestamp;
}

export type LabEvent = DeployEvent | BackupEvent | FaultEvent;

/**
 * Snapshot of the lab at one moment.
 * @title SLS Office snapshot v1
 * @description Lab state written by the collector and read by the SLS Office page.
 */
export interface Snapshot {
  v: typeof SNAPSHOT_VERSION;
  /** Time the collector took the snapshot. */
  at: Timestamp;
  host: Host;
  vms: Vm[];
  /** Events since the previous snapshot. */
  events: LabEvent[];
}
