import type { SiteEnv } from '../contract/snapshot.ts';

export interface SiteSpec {
  id: string;
  client: string;
  site: string;
  env: SiteEnv;
  siteType: string;
  /** Engine the site needs; it goes unhealthy while sls-data is down. */
  db: 'postgres' | 'mysql' | null;
  /** Share of the compute VM's load this site takes. */
  weight: number;
  /** Per-site wobble speed and phase, so the sites do not move in lockstep. */
  wobbleRate: number;
  wobblePhase: number;
}

type SiteRow = readonly [client: string, site: string, env: SiteEnv, siteType: string, db: SiteSpec['db']];

const SITE_ROWS: readonly SiteRow[] = [
  ['scrd', 'server', 'develop', 'node-api', 'postgres'],
  ['scrd', 'client', 'develop', 'node-static', null],
  ['scrd', 'admin', 'develop', 'node-static', null],
  ['scrd', 'site', 'develop', 'node-ssr', null],
  ['bsra', 'bsra', 'develop', 'wordpress', 'mysql'],
  ['bsra', 'bsra', 'staging', 'wordpress', 'mysql'],
  ['bsra', 'bsra', 'production', 'wordpress', 'mysql'],
  ['forms-api', 'api', 'develop', 'node-api', 'postgres'],
  ['forms-api', 'api', 'production', 'node-api', 'postgres'],
  ['lab-test', 'web', 'develop', 'node-static', null],
  ['lab-test', 'blog', 'develop', 'wordpress', 'mysql'],
  ['lab-test', 'api', 'develop', 'node-api', 'postgres'],
];

const SITE_WEIGHTS: readonly number[] = [1.2, 0.7, 0.6, 0.9, 0.8, 0.7, 1.1, 0.9, 1.15, 0.6, 0.8, 0.9];

export const SITE_SPECS: readonly SiteSpec[] = SITE_ROWS.map(([client, site, env, siteType, db], index) => ({
  id: `${client}-${site}-${env}`,
  client,
  site,
  env,
  siteType,
  db,
  weight: SITE_WEIGHTS[index] ?? 1,
  wobbleRate: 0.25 + ((index * 7) % 5) * 0.06,
  wobblePhase: index * 1.9,
}));

export interface ServiceSpec {
  kind: 'platform' | 'engine';
  id: string;
  /** Share of the host VM's cpu this service takes. */
  share: number;
}

export const PLATFORM_SERVICES: readonly ServiceSpec[] = [
  { kind: 'platform', id: 'traefik', share: 0.45 },
  { kind: 'platform', id: 'cloudflared-1', share: 0.3 },
  { kind: 'platform', id: 'cloudflared-2', share: 0.28 },
  { kind: 'platform', id: 'gatus', share: 0.2 },
];

export const ENGINE_SERVICES: readonly ServiceSpec[] = [
  { kind: 'engine', id: 'postgres', share: 0.5 },
  { kind: 'engine', id: 'mysql', share: 0.35 },
];
