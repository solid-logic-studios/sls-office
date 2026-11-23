import type { Painter } from '../../contract/painter.ts';
import type { Findings, Temps, VmRole, Workload } from '../../contract/snapshot.ts';
import type { DecorFn, Prop, Rect, Severity, StageView } from '../../contract/theme.ts';
import { sitesOf } from '../hq/ground-deck.ts';
import { TAU, disc, dot, orbitPoint, wave, type Orbit } from '../hq/kit.ts';
import { ALARM, AMBER, CYAN, HULL, INK, LAMP, ROOMS, STEEL, UNLIT } from '../hq/palette.ts';
import { clientStyle } from '../office/looks.ts';
import { pen } from '../shared/pen.ts';
import { SENSOR_ORDER, TEMP_COLOURS, TEMP_SENSORS, readingOf } from '../shared/temps.ts';
import {
  COUCH,
  FINDINGS_LAMP,
  GEAR_RACK,
  HOLO_PEDESTAL,
  POD_OVERFLOW,
  SILO,
  SITE_OVERFLOW,
  TEMP_STRIP,
} from './boards.ts';
import { SPIRE_LAYOUT } from './layout.ts';

/**
 * The Spire's own dressing, for the HQ pieces too big for a 52 px storey: a findings lamp, a holo
 * pedestal, the couch, a gear rack, the jet silo, a temperature strip and the "+N" overflow signs.
 * HQ colours and HQ kit throughout, so they read as the same HQ. Each is a pure function of the stage.
 */

const isUp = ({ vms }: StageView, role: VmRole): boolean => vms.find((vm) => vm.role === role)?.up ?? false;

/* ------------------------------------------------------------ findings lamp */

/** How bad the host findings are: crit for any critical finding, else warn for any warning, else ok. */
export const findingsSeverity = ({ crit, warn }: Findings): Severity => (crit > 0 ? 'crit' : warn > 0 ? 'warn' : 'ok');

export const LAMP_COLOURS: Readonly<Record<Severity, string>> = { crit: ALARM.base, warn: LAMP.warn, ok: LAMP.ok };

/** The findings lamp on its mast over the motor room: red, amber or green, with a soft halo. */
const paintFindingsLamp: DecorFn = (painter, { findings }) => {
  const { R } = pen(painter);
  const { x, y, w, h } = FINDINGS_LAMP;
  const mid = x + w / 2;
  const colour = LAMP_COLOURS[findingsSeverity(findings)];
  R(STEEL.base, mid - 1, y + 9, 2, h - 9);
  painter.withAlpha(0.3, () => R(colour, x, y, w, 10));
  R(INK, mid - 5, y + 1, 10, 8);
  R(colour, mid - 4, y + 2, 8, 6);
  R(AMBER.white, mid - 3, y + 3, 2, 1);
};

/* ------------------------------------------------------------ holo pedestal */

const HOLO_INDEX = SPIRE_LAYOUT.breakSpots.findIndex((spot) => spot.kind === 'holo');
const GLOBE_R = 6;
const EQUATOR: Orbit = { radius: GLOBE_R, squash: 0.3, tilt: 0 };

/** The holo pedestal: a slim stand throwing the lab's globe. Brighter, with a marker, while someone studies it. */
const paintHoloPedestal: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { now } = stage;
  const { x, y, w, h } = HOLO_PEDESTAL;
  const mid = x + w / 2;
  const foot = y + h;
  const emitter = foot - 12;
  R(INK, x + 3, foot - 3, w - 6, 3);
  R(STEEL.base, x + 4, foot - 3, w - 8, 1);
  R(STEEL.dark, mid - 2, emitter + 1, 4, 9);
  R(STEEL.base, mid - 4, emitter, 8, 2);
  const on = isUp(stage, 'compute');
  R(on ? CYAN.hot : UNLIT, mid - 2, emitter - 1, 4, 1);
  if (!on) return;
  const studied = stage.busyBreakSpots.has(HOLO_INDEX);
  const strength = studied ? 0.9 : 0.55;
  const cy = y + GLOBE_R + 1;
  painter.withAlpha(0.2 * strength, () => disc(painter, CYAN.base, mid, cy, GLOBE_R));
  const colour = studied ? CYAN.hot : CYAN.bright;
  const meridian: Orbit = { radius: GLOBE_R, squash: Math.abs(Math.cos(now * 0.9)), tilt: TAU / 4 };
  painter.withAlpha(strength, () => {
    for (let k = 0; k < 12; k++) {
      for (const orbit of [EQUATOR, meridian]) {
        const p = orbitPoint(orbit, (k * TAU) / 12 + now * 0.6);
        dot(painter, colour, mid + p.x, cy + p.y);
      }
    }
  });
  if (studied) {
    const bob = Math.round(wave(now, 1.2));
    R(AMBER.glow, mid + 2, cy - 4 - bob, 2, 2);
  }
};

/* -------------------------------------------------------------------- couch */

/** The HQ's rec room couch (`hq/index.ts`), at the Spire's gate. */
const COUCH_COLOURS = { back: '#8a3f6a', front: '#753458', top: '#a04d7c', foot: '#5c2845' } as const;

const paintCouchBack: DecorFn = (painter) => {
  painter.rect(COUCH_COLOURS.back, COUCH.x, COUCH.base - 22, COUCH.w, 16);
  painter.rect(ROOMS.rec.accent, COUCH.x, COUCH.base - 22, COUCH.w, 1);
};

const paintCouchFront: DecorFn = (painter) => {
  painter.rect(COUCH_COLOURS.front, COUCH.x, COUCH.base - 8, COUCH.w, 8);
  painter.rect(COUCH_COLOURS.top, COUCH.x, COUCH.base - 8, COUCH.w, 2);
  painter.rect(COUCH_COLOURS.foot, COUCH.x, COUCH.base - 1, COUCH.w, 1);
};

/* ---------------------------------------------------------------- gear rack */

const CRATE = { w: 4, h: 4, pitch: 5 } as const;
const SHELVES = 3;
const PER_SHELF = 4;

/** The gear rack: a crate for every Site instance on the floor, in its squad's colour, top shelf first. */
const paintGearRack: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { x, y, w, h } = GEAR_RACK;
  R(INK, x, y, 2, h);
  R(INK, x + w - 2, y, 2, h);
  R(STEEL.base, x, y, 1, h);
  R(STEEL.base, x + w - 2, y, 1, h);
  const colours = sitesOf(stage).map((site) => clientStyle(site.client).colour);
  for (let shelf = 0; shelf < SHELVES; shelf++) {
    const sy = y + 8 + shelf * 8;
    R(STEEL.light, x, sy, w, 1);
    colours.slice(shelf * PER_SHELF, (shelf + 1) * PER_SHELF).forEach((colour, i) => {
      const cx = x + 3 + i * CRATE.pitch;
      R(INK, cx, sy - CRATE.h, CRATE.w, CRATE.h);
      R(colour, cx + 1, sy - CRATE.h + 1, CRATE.w - 2, CRATE.h - 1);
    });
  }
};

/* --------------------------------------------------------------------- silo */

/** The jet nose up, row by row from the nose: each row's half-width either side of its middle column. */
const JET_ROWS: readonly number[] = [0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
/** The swept fins at the tail: half-width, rows up from the tail. */
const FINS: readonly number[] = [6, 6, 5, 4, 3];
/** How far JARVIS's amber cheat line runs down the fuselage. */
const JARVIS_LINE = 10;

/** The jet silo: the jet stands in it nose up between its rails, and is away at the bunker during a backup. */
const paintSilo: DecorFn = (painter, stage) => {
  const { R, T } = pen(painter);
  const { now, vaultOpen } = stage;
  const { x, y, w, h } = SILO;
  const mid = x + Math.floor(w / 2);
  R(INK, x, y, w, h);
  R(HULL.dark, x + 1, y + 1, w - 2, h - 1);
  for (const rx of [x + 4, x + w - 5]) R(STEEL.dark, rx, y + 4, 1, h - 8);
  // The hatch's hazard rim across the top, and the launch pad at the foot.
  for (let i = 0; i < w - 2; i++) R(i % 4 < 2 ? ROOMS.hangar.accent : INK, x + 1 + i, y + 1, 1, 2);
  R(STEEL.dark, x + 2, y + h - 3, w - 4, 3);
  R(STEEL.base, x + 2, y + h - 3, w - 4, 1);
  if (vaultOpen) {
    // Away: the bay stands empty, its lamp turning while the jet flies the backup.
    T('R2', x + 4, y + 13, ROOMS.hangar.accent);
    R(wave(now, 1.6) > 0.5 ? LAMP.warn : AMBER.rim, x + w - 8, y + 6, 3, 2);
    painter.withAlpha(0.12 + 0.08 * wave(now, 2.4), () => R(STEEL.light, mid - 4, y + 8, 9, h - 12));
    return;
  }
  const nose = y + 6;
  JET_ROWS.forEach((half, i) => {
    R(INK, mid - half - 1, nose + i, half * 2 + 3, 1);
    R(i < 2 ? STEEL.light : HULL.trim, mid - half, nose + i, half * 2 + 1, 1);
  });
  const tail = nose + JET_ROWS.length;
  FINS.forEach((half, i) => R(STEEL.dark, mid - half, tail - 1 - i, half * 2 + 1, 1));
  // The cockpit, JARVIS's amber cheat line, and the core's cyan in the engine.
  R(CYAN.bright, mid, nose + 4, 1, 3);
  R(AMBER.glow, mid + 1, nose + 7, 1, JARVIS_LINE);
  R(INK, mid - 2, tail, 5, 1);
  painter.withAlpha(0.5 + 0.3 * wave(now, 1.4), () => R(CYAN.bright, mid - 1, tail + 1, 3, 1));
};

/* ---------------------------------------------------------------- temperatures */

const TEMP_PITCH = 46;

function paintTemps(painter: Painter, temps: Temps): void {
  SENSOR_ORDER.forEach((sensor, i) => {
    const left = TEMP_STRIP.x + i * TEMP_PITCH;
    const { label } = TEMP_SENSORS[sensor];
    const reading = readingOf(temps, sensor);
    painter.text(label, left, TEMP_STRIP.baseline, STEEL.light);
    const value = left + painter.textWidth(label) + 3;
    if (reading) painter.text(String(reading.celsius), value, TEMP_STRIP.baseline, TEMP_COLOURS[reading.band]);
    else painter.text('--', value, TEMP_STRIP.baseline, TEMP_COLOURS.unknown);
  });
}

/** The three temperatures along the sub-level's floor, under the core. Nothing from a collector that sends none. */
const paintTempStrip: DecorFn = (painter, { host }) => {
  if (host?.temps) paintTemps(painter, host.temps);
};

/* ---------------------------------------------------------------- overflow */

const countOf = (stage: StageView, kind: Workload['kind']): number =>
  stage.vms.reduce((n, vm) => n + vm.workloads.filter((w) => w.kind === kind).length, 0);

function paintSign(painter: Painter, rect: Rect, extra: number): void {
  if (extra <= 0) return;
  const { R, T } = pen(painter);
  R(INK, rect.x, rect.y, rect.w, rect.h);
  R(AMBER.glow, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  T(`+${extra}`, rect.x + rect.w / 2, rect.y + rect.h - 2, INK, 'centre', true);
}

/**
 * The Spire has 12 watch stations and 3 rookie benches, and the Engine draws nobody without a home.
 * So when the lab has more Site instances or pods than that, a "+N" sign on their storey says how
 * many are not shown.
 */
export const paintOverflow: DecorFn = (painter, stage) => {
  const { worker, pod } = SPIRE_LAYOUT.homes;
  paintSign(painter, SITE_OVERFLOW, countOf(stage, 'site-instance') - worker.length);
  paintSign(painter, POD_OVERFLOW, countOf(stage, 'ci-pod') - pod.length);
};

/* ------------------------------------------------------------------- export */

/** Painted in the back layer, after the structure, in this order. */
export const DRESSING_BACK: readonly DecorFn[] = [
  paintFindingsLamp,
  paintHoloPedestal,
  paintCouchBack,
  paintGearRack,
  paintSilo,
  paintTempStrip,
  paintOverflow,
];

/** Depth-sorted with the places and characters by base line: the couch's front, so sitters sit behind it. */
export const DRESSING_PROPS: readonly Prop[] = [{ baseY: COUCH.base, draw: paintCouchFront }];
