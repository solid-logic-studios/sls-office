import type { Painter } from '../../contract/painter.ts';
import type { Host, Temps } from '../../contract/snapshot.ts';
import type { DecorFn, Rect, StageView } from '../../contract/theme.ts';
import { SENSOR_ORDER, TEMP_COLOURS, TEMP_SENSORS, readingOf } from '../office/temps.ts';
import { TAU, disc, dot, wave } from './kit.ts';
import { ALARM, CYAN, HULL, INK, LAMP, ROOMS, STEEL, UNLIT } from './palette.ts';

/**
 * The power core: the lab host, drawn as the reactor under the HQ. Original pixel art, animated from
 * `stage.now` alone.
 *
 * - The hub is the host itself: a ring of plasma round a rotor. Its hot centre swells and it throws
 *   more pulse rings as host CPU climbs. It runs cyan, turns orange when any sensor reads hot and sits
 *   cold and still until the first Snapshot.
 * - Two banks of cells feed it: one lights with host CPU, one with host memory.
 * - Two drive cells hang off it: the SSD, steady, and the worn NVMe, which sputters, sparks and
 *   carries the note that says when it is due to be replaced.
 * - The nameplate gives the three temperatures where the collector sends them.
 */

export interface HubSpec {
  cx: number;
  cy: number;
  r: number;
}

/** Where each part of the core sits. The wide HQ and the phone Spire each bring their own. */
export interface CoreSpec {
  chamber: Rect;
  hub: HubSpec;
  /** The CPU and memory banks: the label's left edge, each row's top and how many cells a row has. */
  banks: { x: number; cpuY: number; memY: number; cells: number };
  /** The two drive cells, right of the hub: each one's left edge and their shared top. */
  drives: { ssdX: number; nvmeX: number; y: number };
  /** The replacement note beside the NVMe cell. Left out where there is no room for it. */
  tag?: Rect;
  /** The nameplate: its left edge and the baselines of its three lines. */
  plate?: { x: number; title: number; model: number; temps: number };
  /** The relay lights: their left edge and top, how many columns, and the baseline of the host's name under them. */
  relays?: { x: number; y: number; columns: number; name: number };
}

/* --------------------------------------------------------------------- tone */

export type CoreTone = 'cold' | 'steady' | 'hot';

interface Plasma {
  deep: string;
  base: string;
  bright: string;
  hot: string;
}

const PLASMA: Readonly<Record<CoreTone, Plasma>> = {
  cold: { deep: '#141c2a', base: '#243248', bright: '#3a4c68', hot: STEEL.base },
  steady: CYAN,
  hot: { deep: '#52200b', base: '#c8501a', bright: '#ff9a4a', hot: '#ffe6c0' },
};

const anyHot = (temps: Temps | undefined): boolean =>
  temps !== undefined && SENSOR_ORDER.some((sensor) => readingOf(temps, sensor)?.band === 'hot');

/** Cold until the first Snapshot, hot while any sensor reads hot, otherwise steady. */
export function coreTone({ host }: Pick<StageView, 'host'>): CoreTone {
  if (host === null) return 'cold';
  return anyHot(host.temps) ? 'hot' : 'steady';
}

/* ---------------------------------------------------------------------- hub */

const ROTOR_ARMS = 3;
const PULSE_SECONDS = 1.6;
const RING_DOTS = 16;

/** The steel housing: a ring with eight bolts and a lug at each compass point. */
function paintHousing(painter: Painter, { cx, cy, r }: HubSpec): void {
  for (const [dx, dy, w, h] of [
    [-3, -r - 3, 6, 4],
    [-3, r, 6, 4],
    [-r - 3, -3, 4, 6],
    [r, -3, 4, 6],
  ] as const) {
    painter.rect(STEEL.dark, cx + dx, cy + dy, w, h);
  }
  disc(painter, STEEL.dark, cx, cy, r + 1);
  disc(painter, STEEL.base, cx, cy, r);
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * (TAU / 8);
    dot(painter, STEEL.shine, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1));
  }
  disc(painter, INK, cx, cy, r - 2);
}

/** The rotor: three arms of dots turning at a steady pace, each with a bright tip. */
function paintRotor(painter: Painter, { cx, cy, r }: HubSpec, plasma: Plasma, now: number): void {
  for (let arm = 0; arm < ROTOR_ARMS; arm++) {
    const a = now * 1.4 + (arm * TAU) / ROTOR_ARMS;
    for (let reach = Math.round(r * 0.5) + 1; reach <= r - 6; reach += 2) {
      dot(painter, plasma.bright, cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
    }
    dot(painter, plasma.hot, cx + Math.cos(a) * (r - 5) - 0.5, cy + Math.sin(a) * (r - 5) - 0.5, 2);
  }
}

/** Dotted rings swelling out from the centre and fading: one at rest, three flat out. */
function paintPulses(painter: Painter, { cx, cy, r }: HubSpec, plasma: Plasma, now: number, load: number): void {
  const rings = 1 + Math.min(2, Math.floor(load * 3));
  for (let ring = 0; ring < rings; ring++) {
    const phase = (now / PULSE_SECONDS + ring / rings) % 1;
    const reach = 4 + phase * (r - 8);
    painter.withAlpha(1 - phase, () => {
      for (let k = 0; k < RING_DOTS; k++) {
        const a = (k * TAU) / RING_DOTS;
        dot(painter, plasma.hot, cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
      }
    });
  }
}

/** `load` is host CPU as 0 to 1: it swells the hot centre and adds pulse rings. A cold hub holds still. */
export function paintCoreHub(painter: Painter, hub: HubSpec, tone: CoreTone, now: number, load: number): void {
  const { cx, cy, r } = hub;
  const plasma = PLASMA[tone];
  const live = tone !== 'cold';
  const breath = live ? wave(now, PULSE_SECONDS) : 0;
  painter.withAlpha(0.1 + 0.08 * breath, () => disc(painter, plasma.bright, cx, cy, r + 4));
  paintHousing(painter, hub);
  disc(painter, plasma.deep, cx, cy, r - 3);
  disc(painter, plasma.base, cx, cy, r - 5 + Math.round(breath));
  if (live) paintRotor(painter, hub, plasma, now);
  disc(painter, plasma.bright, cx, cy, Math.round(r * 0.5));
  disc(painter, plasma.hot, cx, cy, Math.round(r * (0.2 + 0.2 * load)));
  if (live) paintPulses(painter, hub, plasma, now, load);
}

/* -------------------------------------------------------------------- banks */

const CELL = { w: 7, h: 8, pitch: 9 } as const;
/** From the bank's left edge to its first cell: a three-letter label and a gap. */
const BANK_LABEL = 24;

/** Where a bank of `cells` ends, from its left edge. */
export const bankWidth = (cells: number): number => BANK_LABEL + cells * CELL.pitch - (CELL.pitch - CELL.w);

/** A cell near the top of the bank warns: amber past three quarters, red past nine tenths. */
const cellColour = (index: number, cells: number): string =>
  index / cells > 0.9 ? ALARM.base : index / cells > 0.75 ? LAMP.warn : CYAN.bright;

/** A row of cells that light from the left with `value` (0 to 100). All dark with no reading. */
function paintBank(
  painter: Painter,
  [x, y]: readonly [number, number],
  label: string,
  cells: number,
  value: number | undefined,
  now: number,
): void {
  painter.text(label, x, y + CELL.h, STEEL.light);
  const lit = value === undefined ? 0 : Math.round((value / 100) * cells);
  for (let i = 0; i < cells; i++) {
    const cx = x + BANK_LABEL + i * CELL.pitch;
    painter.rect(INK, cx - 1, y - 1, CELL.w + 2, CELL.h + 2);
    painter.rect(i < lit ? cellColour(i, cells) : UNLIT, cx, y, CELL.w, CELL.h);
    // The newest cell shimmers.
    if (i === lit - 1 && Math.floor(now * 2) % 2 === 0) painter.rect(CYAN.hot, cx + 1, y + 1, CELL.w - 2, 1);
  }
}

/* ----------------------------------------------------------------- conduits */

/** A pipe from `x0` to `x1` with dashes flowing along it towards `x1`. `flowing` false leaves it dark. */
function paintConduit(painter: Painter, x0: number, x1: number, y: number, now: number, flowing: boolean): void {
  const [left, right] = x0 < x1 ? [x0, x1] : [x1, x0];
  painter.rect(STEEL.dark, left, y, right - left, 2);
  if (!flowing) return;
  const step = Math.floor(now * 12) % 6;
  const offset = x0 < x1 ? step : 5 - step;
  for (let x = left + offset; x < right - 1; x += 6) painter.rect(CYAN.bright, x, y, 2, 1);
}

/** How far left of the hub's centre its housing reaches on the row `dy` from the centre. */
const housingEdge = ({ r }: HubSpec, dy: number): number =>
  Math.floor(Math.sqrt(Math.max(0, (r + 1.5) * (r + 1.5) - dy * dy)));

/* ------------------------------------------------------------------- drives */

const DRIVE = { w: 12, h: 30 } as const;
/** The glass of a drive cell: inset from its left and top, and its size. */
const GLASS = { dx: 2, dy: 4, w: 8, h: 22 } as const;
const DIM_AMBER = '#6a5514';
/** A crack across the NVMe cell's glass. */
const CRACK: readonly (readonly [number, number])[] = [
  [3, 7],
  [4, 9],
  [5, 10],
  [5, 12],
  [7, 13],
  [8, 15],
];
/** Where the sparks jump to, round the top of the cell. One pair shows at a time. */
const SPARKS: readonly (readonly [number, number])[] = [
  [-2, 1],
  [13, -1],
  [5, -3],
  [-1, -2],
  [12, 3],
  [9, -2],
];

function paintDriveShell(painter: Painter, x: number, y: number, label: string): void {
  painter.rect(INK, x + 1, y + 3, DRIVE.w - 2, DRIVE.h - 6);
  painter.rect(UNLIT, x + GLASS.dx, y + GLASS.dy, GLASS.w, GLASS.h);
  for (const capY of [y, y + DRIVE.h - 3]) {
    painter.rect(STEEL.base, x, capY, DRIVE.w, 3);
    painter.rect(STEEL.shine, x, capY, DRIVE.w, 1);
  }
  painter.text(label, x + DRIVE.w / 2, y + DRIVE.h + 9, STEEL.light, { align: 'centre' });
}

/** The SSD: a full, steady cell with a line of light rising through it. */
function paintSteadyDrive(painter: Painter, x: number, y: number, now: number, live: boolean): void {
  paintDriveShell(painter, x, y, 'SSD');
  if (!live) return;
  painter.rect(CYAN.base, x + GLASS.dx, y + GLASS.dy, GLASS.w, GLASS.h);
  painter.rect(CYAN.bright, x + GLASS.dx + 2, y + GLASS.dy, GLASS.w - 4, GLASS.h);
  painter.rect(CYAN.hot, x + GLASS.dx, y + GLASS.dy + GLASS.h - 1 - (Math.floor(now * 6) % GLASS.h), GLASS.w, 1);
}

/** Lit most of the time, with dropouts at no steady beat: the flicker of a part on its way out. */
export const sputterOn = (now: number): boolean => Math.sin(now * 17) + Math.sin(now * 5.1) > -0.4;

/** The worn NVMe: under half charge, flickering, cracked and throwing the odd spark. Red when it runs hot. */
function paintSputteringDrive(painter: Painter, x: number, y: number, now: number, live: boolean, hot: boolean): void {
  paintDriveShell(painter, x, y, 'NVME');
  if (live) {
    const on = sputterOn(now);
    const charge = 10;
    const top = y + GLASS.dy + GLASS.h - charge;
    painter.rect(
      on ? (hot ? ALARM.base : LAMP.warn) : hot ? ALARM.deep : DIM_AMBER,
      x + GLASS.dx,
      top,
      GLASS.w,
      charge,
    );
    if (on) painter.rect(hot ? ALARM.white : '#ffe9a8', x + GLASS.dx, top, GLASS.w, 1);
    const frame = Math.floor(now * 10);
    if (!on || frame % 7 === 0) {
      for (const pick of [frame, frame + 3]) {
        const [dx, dy] = SPARKS[pick % SPARKS.length] ?? [0, 0];
        painter.rect('#fff6dc', x + dx, y + dy, 1, 1);
      }
    }
  }
  for (const [dx, dy] of CRACK) painter.rect(INK, x + dx, y + dy, 1, 2);
}

/** The note on a string: when the worn NVMe is due to be replaced. */
function paintTag(painter: Painter, { x, y, w, h }: Rect, stringTo: readonly [number, number]): void {
  const [sx, sy] = stringTo;
  painter.rect(STEEL.light, sx, sy, x - sx, 1);
  painter.rect('#c9b84e', x + 1, y + 1, w - 1, h - 1);
  painter.rect('#f6e27a', x, y, w - 1, h - 1);
  painter.text('REPLACE', x + 3, y + 8, '#5a4a1c');
  painter.text('JAN 2027', x + 3, y + 16, '#5a4a1c');
}

/* ------------------------------------------------------------------ chamber */

const RIB_PITCH = 40;
const TEMP_PITCH = 46;

function paintChamber(painter: Painter, { x, y, w, h }: Rect, hub: HubSpec): void {
  const room = ROOMS.sublevel;
  painter.rect(room.wall, x, y, w, h);
  for (let rx = x + RIB_PITCH / 2; rx < x + w; rx += RIB_PITCH) painter.rect(room.shade, rx, y, 2, h - 6);
  painter.rect(room.floor, x, y + h - 6, w, 6);
  painter.rect(room.line, x, y + h - 6, w, 1);
  painter.rect(HULL.light, x, y, w, 1);
  // The cradle: a recess the hub sits in, with a rail either side.
  const half = hub.r + 7;
  painter.rect(room.shade, hub.cx - half, y + 1, half * 2, h - 1);
  painter.rect(HULL.light, hub.cx - half, y + 1, 1, h - 1);
  painter.rect(HULL.light, hub.cx + half - 1, y + 1, 1, h - 1);
}

function paintTemps(painter: Painter, temps: Temps, x: number, baseline: number): void {
  SENSOR_ORDER.forEach((sensor, i) => {
    const left = x + i * TEMP_PITCH;
    const { label } = TEMP_SENSORS[sensor];
    const reading = readingOf(temps, sensor);
    painter.text(label, left, baseline, STEEL.base);
    const value = left + painter.textWidth(label) + 3;
    if (reading) painter.text(String(reading.celsius), value, baseline, TEMP_COLOURS[reading.band]);
    else painter.text('--', value, baseline, TEMP_COLOURS.unknown);
  });
}

function paintPlate(painter: Painter, plate: NonNullable<CoreSpec['plate']>, host: Host | null): void {
  painter.text('POWER CORE', plate.x, plate.title, CYAN.bright, { bold: true });
  painter.text('OPTIPLEX 7070 MICRO', plate.x, plate.model, STEEL.base);
  if (host?.temps) paintTemps(painter, host.temps, plate.x, plate.temps);
}

/** Two rows of relay lights that never quite repeat, and the host's name under them. */
function paintRelays(painter: Painter, relays: NonNullable<CoreSpec['relays']>, host: Host | null, now: number): void {
  const live = host !== null;
  for (let i = 0; i < relays.columns; i++) {
    const x = relays.x + i * 6;
    painter.rect(live && Math.sin(now * 3 + i * 1.7) > 0 ? LAMP.ok : '#1f3a2a', x, relays.y, 2, 2);
    painter.rect(live && Math.sin(now * 5 + i * 2.3) > 0.3 ? CYAN.bright : '#1f2f3f', x, relays.y + 6, 2, 2);
  }
  if (host) {
    painter.text(host.name.toUpperCase(), relays.x + relays.columns * 6 - 4, relays.name, STEEL.base, {
      align: 'right',
    });
  }
}

/** The whole core, placed by `spec`: chamber, banks, conduits, hub, drives, note, nameplate and relays. */
export function powerCore(spec: CoreSpec): DecorFn {
  const { chamber, hub, banks, drives, tag, plate, relays } = spec;
  const bankEnd = banks.x + bankWidth(banks.cells);
  const driveMidY = drives.y + DRIVE.h / 2;
  return (painter, stage) => {
    const { now, host } = stage;
    const tone = coreTone(stage);
    const live = tone !== 'cold';
    paintChamber(painter, chamber, hub);
    // The spine leaves the top of the hub for the decks above.
    painter.rect(STEEL.dark, hub.cx - 2, chamber.y, 4, hub.cy - hub.r - chamber.y);
    if (live) painter.rect(CYAN.bright, hub.cx - 1, chamber.y + ((Math.floor(now * 10) + 3) % 5), 2, 2);
    for (const [y, label, value] of [
      [banks.cpuY, 'CPU', host?.cpu],
      [banks.memY, 'MEM', host?.mem],
    ] as const) {
      paintBank(painter, [banks.x, y], label, banks.cells, value, now);
      const row = y + CELL.h / 2 - 1;
      paintConduit(painter, bankEnd + 1, hub.cx - housingEdge(hub, row - hub.cy), row, now, live);
    }
    paintConduit(painter, hub.cx + hub.r + 2, drives.ssdX, driveMidY, now, live);
    paintConduit(painter, drives.ssdX + DRIVE.w, drives.nvmeX, driveMidY, now, live && sputterOn(now));
    paintCoreHub(painter, hub, tone, now, (host?.cpu ?? 0) / 100);
    paintSteadyDrive(painter, drives.ssdX, drives.y, now, live);
    const nvme = host?.temps ? readingOf(host.temps, 'nvme') : null;
    paintSputteringDrive(painter, drives.nvmeX, drives.y, now, live, nvme?.band === 'hot');
    if (tag) paintTag(painter, tag, [drives.nvmeX + DRIVE.w, tag.y + 4]);
    if (plate) paintPlate(painter, plate, host);
    if (relays) paintRelays(painter, relays, host, now);
  };
}
