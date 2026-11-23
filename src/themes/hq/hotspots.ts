import type { Hotspot, Severity, StageView, Tip } from '../../contract/theme.ts';
import { hostTip } from '../office/hotspots.ts';
import { JARVIS_CONSOLE, POWER_CORE } from './boards.ts';
import { jarvisState, type JarvisState } from './jarvis-state.ts';

/** Hover text for the HQ's set pieces. The Engine handles rooms and characters. */

const JARVIS_DETAIL =
  "JARVIS, the HQ's AI. In the lab it is the orchestrator of the /ticket loop: it triages, scopes and hands the build to the team. The orb shows what it is attending to.";

const JARVIS_STATUS: Readonly<Record<JarvisState, { status: string; severity: Severity }>> = {
  waking: { status: 'Waiting on the first Snapshot', severity: 'ok' },
  idle: { status: 'At the helm', severity: 'ok' },
  deploy: { status: 'Overseeing a deploy', severity: 'ok' },
  ci: { status: 'Watching the rookies run CI', severity: 'ok' },
  backup: { status: 'Tracking the backup run', severity: 'ok' },
  night: { status: 'Keeping the quiet watch', severity: 'ok' },
  alarm: { status: 'All hands: something is down or critical', severity: 'crit' },
};

export const jarvisTip = (stage: StageView): Tip => ({
  title: 'JARVIS',
  detail: JARVIS_DETAIL,
  ...JARVIS_STATUS[jarvisState(stage)],
});

const CORE_DETAIL =
  'Lab host: the power core under the HQ. Proxmox VE 9.2 on an OptiPlex 7070 Micro. The NVMe cell is worn and sputters (acknowledged), replacement planned for January 2027.';

/** The Office's host reading, in the HQ's words. */
export const coreTip = (stage: StageView): Tip => ({ ...hostTip(stage), detail: CORE_DETAIL });

export const HOTSPOTS: readonly Hotspot[] = [
  { rect: JARVIS_CONSOLE, tip: jarvisTip },
  { rect: POWER_CORE, tip: coreTip },
];
