import type { Health, ServiceWorkload, Temps } from '../../contract/snapshot.ts';
import type { Hotspot, Severity, StageView, Tip } from '../../contract/theme.ts';
import {
  CLOUD_OFFICE,
  DISCORD,
  FRIDGE,
  HEALTHCHECKS,
  HOST_STRIP,
  MYSQL_CABINET,
  PLAQUE,
  POSTER,
  POSTGRES_CABINET,
  PUTTING_GREEN,
  SCOREBOARD,
  SCRD_RACK,
  VAULT,
} from './boards.ts';
import { SPORT_NAMES, scoreAt } from './scoreboard.ts';
import { SENSOR_ORDER, TEMP_SENSORS, readingOf } from '../shared/temps.ts';

/** Hover text for the set dressing. The Engine handles rooms and characters; the Theme handles the walls. */

export const HEALTH_WORDS: Readonly<Record<Health, { status: string; severity: Severity }>> = {
  healthy: { status: 'Healthy', severity: 'ok' },
  starting: { status: 'Starting', severity: 'warn' },
  unhealthy: { status: 'Unhealthy', severity: 'crit' },
  down: { status: 'Down', severity: 'crit' },
};

const decor = (title: string, detail: string): Tip => ({ title, detail, status: 'Decor', severity: 'ok' });

/** A filing cabinet stands for one `engine` workload on the data VM, in Snapshot order. */
function cabinetTip(index: number, title: string, detail: string, stage: StageView): Tip {
  const data = stage.vms.find((vm) => vm.role === 'data');
  const engines = data?.workloads.filter((w): w is ServiceWorkload => w.kind === 'engine') ?? [];
  const engine = engines[index];
  if (!engine) return { title, detail, status: 'No reading yet', severity: 'ok' };
  const { status, severity } = HEALTH_WORDS[engine.health];
  return { title, detail, cpu: engine.cpu, mem: engine.mem, status, severity };
}

const HOST_DETAIL =
  'Lab host: the building itself. Proxmox VE 9.2 on an OptiPlex 7070 Micro. One NVMe is worn (acknowledged), replacement planned for January 2027.';

/** The sentence spelling out the readings, e.g. `. CPU 71 °C, chipset unreadable, NVMe 56 °C`; empty with no temps. */
function tempsSentence(temps: Temps | undefined): { text: string; hot: boolean } {
  if (!temps) return { text: '', hot: false };
  const readings = SENSOR_ORDER.map((sensor) => ({
    name: TEMP_SENSORS[sensor].name,
    reading: readingOf(temps, sensor),
  }));
  const parts = readings.map(({ name, reading }) => (reading ? `${name} ${reading.celsius} °C` : `${name} unreadable`));
  return { text: `. ${parts.join(', ')}`, hot: readings.some(({ reading }) => reading?.band === 'hot') };
}

export function hostTip({ host }: StageView): Tip {
  if (!host) return { title: 'Lab host', detail: HOST_DETAIL, status: 'Waiting on the first Snapshot', severity: 'ok' };
  const { text, hot } = tempsSentence(host.temps);
  return {
    title: host.name,
    detail: HOST_DETAIL,
    cpu: host.cpu,
    mem: host.mem,
    status: `Running. NVMe SMART warning acknowledged${text}`,
    severity: hot ? 'crit' : 'warn',
  };
}

export const vaultTip = ({ vaultOpen }: StageView): Tip => ({
  title: 'R2 vault',
  detail:
    'Off-site Cloudflare R2 bucket. Nightly at 02:30 the Archivist wheels over age-encrypted dumps and volume tars. 30-day bucket lock.',
  status: vaultOpen ? 'Backup in progress' : 'Locked',
  severity: 'ok',
});

export const postgresTip = (stage: StageView): Tip =>
  cabinetTip(0, 'PostgreSQL 16', 'Filing cabinet on sls-data. One database and role per Site instance.', stage);

export const mysqlTip = (stage: StageView): Tip =>
  cabinetTip(1, 'MySQL 8.4', 'Filing cabinet on sls-data. WordPress sites file their posts here.', stage);

export const HOTSPOTS: readonly Hotspot[] = [
  {
    rect: PLAQUE,
    tip: () => ({
      title: 'SMP Buildcrete',
      detail: 'Our first client. The brass plaque stays up forever.',
      status: 'Hosted off-site on DigitalOcean',
      severity: 'ok',
    }),
  },
  {
    rect: CLOUD_OFFICE,
    tip: () => ({
      title: 'SMP Buildcrete',
      detail:
        'Remote branch office in the cloud: a WordPress site on a legacy DigitalOcean droplet (Nginx + PHP-FPM, frozen).',
      status: 'Serving',
      severity: 'ok',
    }),
  },
  { rect: VAULT, tip: vaultTip },
  { rect: POSTGRES_CABINET, tip: postgresTip },
  { rect: MYSQL_CABINET, tip: mysqlTip },
  {
    rect: HEALTHCHECKS,
    tip: ({ findings }) => ({
      title: 'Healthchecks.io',
      detail:
        "The dead man's switch. The lab pings it every 15 minutes; if the pings stop or verify goes critical, Discord hears about it.",
      status: findings.crit > 0 ? 'Failing' : 'Pinging',
      severity: findings.crit > 0 ? 'crit' : 'ok',
    }),
  },
  {
    rect: SCOREBOARD,
    tip: ({ now }) => {
      const { sport, a, b } = scoreAt(now);
      return {
        title: 'SCRD scoreboard',
        detail: 'SCRD is our own scoring platform: mostly squash, and now racquetball too.',
        status: `${SPORT_NAMES[sport]} ${a}-${b}`,
        severity: 'ok',
      };
    },
  },
  {
    rect: SCRD_RACK,
    tip: () => ({
      title: 'SCRD',
      detail:
        'Squash racquet, racquetball racquet and one of each ball. Server, client, admin and site all run on the floor.',
      status: 'On the rack',
      severity: 'ok',
    }),
  },
  {
    rect: DISCORD,
    tip: ({ findings }) => ({
      title: 'Discord alerts',
      detail: 'Siren and phone: critical findings page #alerts, warnings go to #lab-digest.',
      status: findings.crit > 0 ? `${findings.crit} critical` : 'Quiet',
      severity: findings.crit > 0 ? 'crit' : 'ok',
    }),
  },
  {
    rect: POSTER,
    tip: () =>
      decor(
        'LAN corner poster',
        'Original pixel sci-fi art. The couch and telly are for Halo nights and Battle Golf grudge matches.',
      ),
  },
  {
    rect: FRIDGE,
    tip: () => decor('The fridge', "Kids' drawings on the door. Meat pies inside (Dhruv's, allegedly)."),
  },
  {
    rect: PUTTING_GREEN,
    tip: () => decor('Putting green', 'A nod to Super Battle Golf. Idle workers queue for a turn.'),
  },
  { rect: HOST_STRIP, tip: hostTip },
];
