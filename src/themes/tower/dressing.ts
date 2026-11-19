import type { Painter } from '../../contract/painter.ts';
import type { Findings, ServiceWorkload, Vm, Workload } from '../../contract/snapshot.ts';
import type { DecorFn, Rect, Severity } from '../../contract/theme.ts';
import { pen } from '../office/pen.ts';
import { FINDINGS_LAMP, MYSQL_CABINET, POD_OVERFLOW, POSTGRES_CABINET, RUNNER_RACK, SITE_OVERFLOW } from './boards.ts';
import { TOWER_LAYOUT } from './layout.ts';

/** The set dressing that moves or lights up. Each piece is a pure function of the stage. */

/** How bad the host findings are: crit for any critical finding, else warn for any warning, else ok. */
export const findingsSeverity = ({ crit, warn }: Findings): Severity => (crit > 0 ? 'crit' : warn > 0 ? 'warn' : 'ok');

/** The roof lamp's colour: red, amber or green. */
export const LAMP_COLOURS: Readonly<Record<Severity, string>> = { crit: '#ff3b30', warn: '#f2c230', ok: '#5fcf7a' };

export const findingsLamp = (findings: Findings): string => LAMP_COLOURS[findingsSeverity(findings)];

const paintFindingsLamp: DecorFn = (painter, { findings }) => {
  const { R } = pen(painter);
  const { x, y, w } = FINDINGS_LAMP;
  const mid = x + w / 2;
  const colour = findingsLamp(findings);
  R('#8d94a0', mid - 1, y + 8, 2, 10);
  painter.withAlpha(0.3, () => R(colour, mid - 8, y, 16, 10));
  R('#2a2533', mid - 5, y + 1, 10, 8);
  R(colour, mid - 4, y + 2, 8, 6);
  R('#ffffff', mid - 3, y + 3, 2, 1);
};

/** The keeper's open drawer: the middle one of each cabinet, pulled out with the files showing. */
const paintDrawers: DecorFn = (painter, { openStores }) => {
  const { R } = pen(painter);
  const cabinets: readonly (readonly [Rect, string, string])[] = [
    [POSTGRES_CABINET, '#1c2b40', '#8fb0d8'],
    [MYSQL_CABINET, '#402c14', '#e6b478'],
  ];
  cabinets.forEach(([{ x, y, w }, hole, face], index) => {
    if (!openStores.has(index)) return;
    R(hole, x + 1, y + 10, w - 2, 8);
    R(face, x + 1, y + 13, w - 2, 8);
    R('#f4f1e6', x + 4, y + 11, w - 8, 2);
  });
};

const runnerOf = (vms: readonly Vm[]): ServiceWorkload | undefined =>
  vms.find((vm) => vm.role === 'deploy')?.workloads.find((w): w is ServiceWorkload => w.kind === 'runner');

const RUNNER_LIGHTS = { healthy: '#5fcf7a', starting: '#f0b840', unhealthy: '#ff6b5e', down: '#ff6b5e' } as const;

/** The build rack's lights: the runner's health, flickering faster the busier it is. Dark with no runner. */
const paintRunnerLights: DecorFn = (painter, { now, vms }) => {
  const { R } = pen(painter);
  const runner = runnerOf(vms);
  const { x, y } = RUNNER_RACK;
  for (let i = 0; i < 4; i++) {
    const on = runner !== undefined && Math.sin(now * (2 + runner.cpu / 10) + i * 1.9) > -0.2;
    R(on ? RUNNER_LIGHTS[runner.health] : '#26262e', x + 3, y + 4 + i * 6, 2, 2);
    R(on ? '#7fd0ff' : '#1f2f3f', x + 7, y + 4 + i * 6, 2, 2);
  }
};

/* ----------------------------------------------------------------- overflow */

const countOf = (vms: readonly Vm[], kind: Workload['kind']): number =>
  vms.reduce((n, vm) => n + vm.workloads.filter((w) => w.kind === kind).length, 0);

function paintSign(painter: Painter, rect: Rect, extra: number): void {
  if (extra <= 0) return;
  const { R, T } = pen(painter);
  R('#2a2533', rect.x, rect.y, rect.w, rect.h);
  R('#f2c230', rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  T(`+${extra}`, rect.x + rect.w / 2, rect.y + rect.h - 2, '#2a2533', 'centre', true);
}

/**
 * The Tower has 12 desks and 3 pod benches, and the Engine draws nobody without a home. So when
 * the lab has more site instances or pods than that, a "+N" sign on their storey says how many
 * are not shown: storey 2 for the workers, storey 4 for the pods.
 */
export const paintOverflow: DecorFn = (painter, { vms }) => {
  const { worker, pod } = TOWER_LAYOUT.homes;
  paintSign(painter, SITE_OVERFLOW, countOf(vms, 'site-instance') - worker.length);
  paintSign(painter, POD_OVERFLOW, countOf(vms, 'ci-pod') - pod.length);
};

export const DRESSING: readonly DecorFn[] = [paintFindingsLamp, paintDrawers, paintRunnerLights, paintOverflow];
