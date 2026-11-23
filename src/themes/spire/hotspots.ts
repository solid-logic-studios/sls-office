import type { Hotspot, StageView, Tip } from '../../contract/theme.ts';
import { beaconTip, clockTip, emblemTip, gateTip, holoTip, rackTip } from '../hq/ground-deck.ts';
import { coreTip, jarvisTip } from '../hq/hotspots.ts';
import { bunkerTip } from '../hq/jet.ts';
import { bagTip, brewTip, mysqlLockerTip, postgresLockerTip, suitUpTip, trophyTip } from '../hq/upper-deck.ts';
import { CORE, FINDINGS_LAMP, GEAR_RACK, HOLO_PEDESTAL, JARVIS, JARVIS_ORB, SILO } from './boards.ts';
import { findingsSeverity } from './dressing.ts';
import {
  BAG,
  BEACONS,
  BREW,
  BUNKER,
  CLOCK,
  GATEWAY,
  MYSQL,
  PGSQL,
  RUNNER_LIGHTS,
  SHIELD,
  TROPHY,
  TUBE,
  beaconHover,
} from './set.ts';

/** Hover text for the Spire's set pieces: the HQ's words, on the Spire's rectangles. The Engine does rooms and people. */

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
  { rect: JARVIS_ORB, tip: jarvisTip },
  { rect: JARVIS.readout, tip: jarvisTip },
  { rect: FINDINGS_LAMP, tip: lampTip },
  { rect: SHIELD.rect, tip: emblemTip },
  { rect: BUNKER.rect, tip: bunkerTip },
  { rect: SILO, tip: bunkerTip },
  { rect: BREW.rect, tip: brewTip },
  { rect: TROPHY.rect, tip: trophyTip },
  { rect: TUBE.rect, tip: suitUpTip },
  { rect: BAG.rect, tip: bagTip },
  { rect: PGSQL.rect, tip: postgresLockerTip },
  { rect: MYSQL.rect, tip: mysqlLockerTip },
  { rect: RUNNER_LIGHTS.rect, tip: rackTip },
  { rect: GEAR_RACK, tip: rackTip },
  { rect: GATEWAY.rect, tip: gateTip },
  { rect: CLOCK.rect, tip: clockTip },
  { rect: HOLO_PEDESTAL, tip: holoTip },
  ...BEACONS.map(({ rect }): Hotspot => ({ rect: beaconHover(rect), tip: beaconTip })),
  { rect: CORE.chamber, tip: coreTip },
];
