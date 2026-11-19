import type { Hotspot, StageView, Tip } from '../../contract/theme.ts';
import { HEALTH_WORDS, hostTip, mysqlTip, postgresTip, vaultTip } from '../office/hotspots.ts';
import { FINDINGS_LAMP, MYSQL_CABINET, PLANT_ROOM, POSTGRES_CABINET, RUNNER_RACK, VAULT } from './boards.ts';
import { findingsSeverity, runnerOf } from './dressing.ts';

/** Hover text for the set pieces. The Office's words where the piece is the Office's; the Engine does rooms and people. */

const RUNNER_DETAIL = 'Build rack on sls-deploy: the runner that builds images, deploys and seeds lab Site instances.';

function runnerTip({ vms }: StageView): Tip {
  const runner = runnerOf(vms);
  if (!runner) return { title: 'Deploy runner', detail: RUNNER_DETAIL, status: 'No reading yet', severity: 'ok' };
  const { status, severity } = HEALTH_WORDS[runner.health];
  return { title: runner.name, detail: RUNNER_DETAIL, cpu: runner.cpu, mem: runner.mem, status, severity };
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function lampTip({ findings }: StageView): Tip {
  return {
    title: 'Findings lamp',
    detail: 'The lab host findings: red for a critical finding, amber for a warning, green when all is clear.',
    status: `${plural(findings.crit, 'critical finding')}, ${plural(findings.warn, 'warning')}`,
    severity: findingsSeverity(findings),
  };
}

export const HOTSPOTS: readonly Hotspot[] = [
  { rect: FINDINGS_LAMP, tip: lampTip },
  { rect: POSTGRES_CABINET, tip: postgresTip },
  { rect: MYSQL_CABINET, tip: mysqlTip },
  { rect: RUNNER_RACK, tip: runnerTip },
  { rect: PLANT_ROOM, tip: hostTip },
  { rect: VAULT, tip: vaultTip },
];
