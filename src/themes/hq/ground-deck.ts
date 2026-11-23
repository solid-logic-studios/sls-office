import type { Painter } from '../../contract/painter.ts';
import type { ServiceWorkload, SiteInstanceWorkload, Vm, VmRole } from '../../contract/snapshot.ts';
import type { DecorFn, Hotspot, Prop, Rect, StageView, Tip } from '../../contract/theme.ts';
import { HEALTH_WORDS } from '../office/hotspots.ts';
import { clientStyle } from '../office/looks.ts';
import { SPORT_NAMES, scoreAt } from '../office/scoreboard.ts';
import { hashOf, mix } from '../shared/hash.ts';
import { pen, type Pen } from '../shared/pen.ts';
import { nightFactor } from '../shared/sky.ts';
import { BANDS, DECK } from './geometry.ts';
import { QUIET_HOURS, jarvisState } from './jarvis-state.ts';
import { TAU, disc, dot, wave } from './kit.ts';
import { HQ_LAYOUT } from './layout.ts';
import { ALARM, AMBER, CYAN, HULL, INK, LAMP, PAPER, ROOMS, STEEL, UNLIT } from './palette.ts';
import { GATE } from './shell.ts';

/*
 * Slice 5: the ground deck's dressing (docs/design/hq-theme.md, sections 4, 6 and 11).
 *
 * - Ops floor: the ops clock over the dispatch desk and its sign, the heartbeat monitor, the tactical
 *   wall (radar, SCRD scoreboard, a load bar per VM), the holo-table at the `holo` break spot, the
 *   alarm beacons under the ceiling and the field across the gate.
 * - Hangar: the gear racks (a crate per Site instance), the runner lights and the blast door.
 * - Roof: the Nines' emblem and the mast beacon.
 *
 * Everything sits on the back wall or the roof, above the furniture, so it is all back layer: no Props.
 * Motion runs off `stage.now` at fixed speeds; readings change colour, count and brightness only.
 */

/* ---------------------------------------------------------------- set pieces */

/** The ops clock, high on the wall over the dispatch desk. `00:00` is 30 px. */
export const OPS_CLOCK: Rect = { x: 34, y: 168, w: 40, h: 15 };
/** The sign over Switchboard's dispatch desk: `DISPATCH` is 48 px; the desk is only 28 wide. */
export const DISPATCH_SIGN: Rect = { x: 27, y: 194, w: 54, h: 13 };
export const HEARTBEAT_MONITOR: Rect = { x: 88, y: 168, w: 48, h: 30 };
/** Radar, SCRD scoreboard and VM load bars, in three panels. */
export const TACTICAL_WALL: Rect = { x: 146, y: 164, w: 194, h: 48 };

const HOLO_INDEX = HQ_LAYOUT.breakSpots.findIndex((spot) => spot.kind === 'holo');
const HOLO_X = HQ_LAYOUT.breakSpots[HOLO_INDEX]?.x ?? 422;
/** The holo-table against the back wall, centred on the `holo` break spot: the hologram over it, the legs behind the stations. */
export const HOLO_TABLE: Rect = { x: HOLO_X - 18, y: 170, w: 36, h: 58 };

/** Where each alarm beacon hangs from the ceiling: two over the ops floor, one in the hangar. */
export const BEACON_XS: readonly number[] = [142, 384, 536];
const BEACON_TOP = BANDS[DECK.ground].ceil + 1;
/** A beacon's hover box: the dome and its bracket. */
export const beaconRect = (x: number): Rect => ({ x: x - 4, y: BEACON_TOP, w: 9, h: 9 });

/** The two gear racks either side of Payload's post, and the runner lights along the top of the wall. */
export const GEAR_RACKS: readonly Rect[] = [
  { x: 477, y: 178, w: 21, h: 48 },
  { x: 521, y: 178, w: 28, h: 48 },
];
const RUNNER_LIGHTS = { x: 478, y: 167, count: 14, step: 6 } as const;
/** The blast door's housing over the hangar door, and the rail it runs down. */
const BLAST_DOOR: Rect = { x: 550, y: 184, w: 12, h: 14 };

/** The Nines' shield on the roof, and the name board beside it. */
export const EMBLEM: Rect = { x: 44, y: 5, w: 23, h: 29 };
const NAME_BOARD = { x: 72, y: 14, w: 60, h: 13, text: 'THE NINES' } as const;
/** The emblem's hover box: shield and name board. */
export const TEAM_EMBLEM: Rect = { x: EMBLEM.x, y: EMBLEM.y, w: NAME_BOARD.x + NAME_BOARD.w - EMBLEM.x, h: EMBLEM.h };
/** The lamp on top of the roof mast (the mast is the shell's, at x 520). */
const MAST_LAMP = { x: 519, y: 7 } as const;

/* ------------------------------------------------------------------ readings */

const vmOf = (stage: StageView, role: VmRole): Vm | undefined => stage.vms.find((vm) => vm.role === role);
const isUp = (stage: StageView, role: VmRole): boolean => vmOf(stage, role)?.up ?? false;
const alarmOn = (stage: StageView): boolean => jarvisState(stage) === 'alarm';

/** The Site instances on the compute VM, in Snapshot order: one hero, one blip, one crate each. */
export const sitesOf = (stage: StageView): SiteInstanceWorkload[] =>
  vmOf(stage, 'compute')?.workloads.filter((w): w is SiteInstanceWorkload => w.kind === 'site-instance') ?? [];

const runnerOf = (stage: StageView): ServiceWorkload | undefined =>
  vmOf(stage, 'deploy')?.workloads.find((w): w is ServiceWorkload => w.kind === 'runner');

const two = (n: number): string => String(n).padStart(2, '0');

/** The time of day as the ops clock reads it, `HH:MM`. */
export function clockText(hour: number): string {
  const minutes = Math.floor((((hour % 24) + 24) % 24) * 60);
  return `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;
}

/* ------------------------------------------------------------------ shared art */

/** A wall screen: an ink edge, a steel bezel and dark glass. Returns the glass. */
function screenFrame({ R }: Pen, { x, y, w, h }: Rect, glass: string): Rect {
  R(INK, x, y, w, h);
  R(STEEL.dark, x + 1, y + 1, w - 2, h - 2);
  R(glass, x + 2, y + 2, w - 4, h - 4);
  return { x: x + 2, y: y + 2, w: w - 4, h: h - 4 };
}

/* -------------------------------------------------------------- the ops clock */

const paintOpsClock: DecorFn = (painter, { now, hour, host }) => {
  const pn = pen(painter);
  const glass = screenFrame(pn, OPS_CLOCK, INK);
  // Bolted to the wall: two steel lugs.
  pn.R(STEEL.base, OPS_CLOCK.x + 4, OPS_CLOCK.y - 2, 2, 2);
  pn.R(STEEL.base, OPS_CLOCK.x + OPS_CLOCK.w - 6, OPS_CLOCK.y - 2, 2, 2);
  const text = clockText(hour);
  // The colon blinks once a second: a few pixels, so a hard blink is allowed.
  const shown = Math.floor(now) % 2 === 0 ? text : text.replace(':', ' ');
  pn.T(shown, glass.x + glass.w / 2, glass.y + 9, host ? CYAN.bright : STEEL.dark, 'centre');
};

const paintDispatchSign: DecorFn = (painter, { host }) => {
  const { R, T } = pen(painter);
  const { x, y, w, h } = DISPATCH_SIGN;
  R(INK, x, y, w, h);
  R(HULL.base, x + 1, y + 1, w - 2, h - 2);
  R(ROOMS.ops.accent, x + 1, y + h - 2, w - 2, 1);
  T('DISPATCH', x + w / 2, y + 9, host ? ROOMS.ops.accent : STEEL.base, 'centre');
};

/* --------------------------------------------------------- heartbeat monitor */

/** One heartbeat, a pixel a column: a small P wave, the spike, a T wave, then the flat. */
const BEAT: readonly number[] = [0, 0, 0, 1, 2, 1, 0, 0, -1, 6, 10, -3, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0];
/** Columns a second the trace scrolls: a calm 46 beats a minute, whatever the lab is doing. */
const TRACE_SPEED = 20;

/** The trace's height at column `i` of a monitor whose trace has moved `shift` columns. */
export const traceAt = (i: number, shift: number): number =>
  BEAT[(((i + shift) % BEAT.length) + BEAT.length) % BEAT.length] ?? 0;

/** Healthchecks.io as a heart monitor: green while it pings, red while a critical finding is open, flat before a Snapshot. */
const paintHeartbeat: DecorFn = (painter, stage) => {
  const pn = pen(painter);
  const { R, T } = pn;
  const glass = screenFrame(pn, HEARTBEAT_MONITOR, HULL.dark);
  const failing = stage.findings.crit > 0;
  const live = stage.host !== null;
  const trace = !live ? STEEL.dark : failing ? ALARM.base : LAMP.ok;
  // A faint grid.
  for (let gx = glass.x + 5; gx < glass.x + glass.w; gx += 8) R(HULL.base, gx, glass.y + 9, 1, glass.h - 9);
  R(HULL.base, glass.x, glass.y + glass.h - 6, glass.w, 1);
  // The heart and the word over the trace.
  const shift = Math.floor(stage.now * TRACE_SPEED);
  const beat = live && shift % BEAT.length < 5;
  const heart = live ? (beat ? trace : failing ? ALARM.dark : '#2f6b47') : UNLIT;
  const hx = glass.x + 2;
  const hy = glass.y + 2;
  R(heart, hx, hy, 2, 1);
  R(heart, hx + 3, hy, 2, 1);
  R(heart, hx, hy + 1, 5, 2);
  R(heart, hx + 1, hy + 3, 3, 1);
  R(heart, hx + 2, hy + 4, 1, 1);
  if (live) T(failing ? 'FAIL' : 'PING', glass.x + glass.w - 1, glass.y + 7, trace, 'right');
  // The trace, scrolling right to left; a vertical stroke joins each column to the last.
  const base = glass.y + glass.h - 6;
  let last = base;
  for (let i = 0; i < glass.w; i++) {
    const y = base - (live ? traceAt(i, shift) : 0);
    const top = Math.min(last, y);
    R(trace, glass.x + i, top, 1, Math.max(last, y) - top + 1);
    last = y;
  }
};

/* ------------------------------------------------------------ tactical wall */

const RADAR_SECONDS = 4;
/** Each panel's left edge and width inside the glass: the radar, the scoreboard, the load bars. */
const PANELS = { radar: [0, 46], score: [47, 72], load: [120, 70] } as const;
/** The load bars' rows, top down, each in its room's accent. */
const LOAD_ROWS: readonly { role: VmRole; accent: string }[] = [
  { role: 'ci', accent: ROOMS.rookieBay.accent },
  { role: 'data', accent: ROOMS.archive.accent },
  { role: 'compute', accent: ROOMS.ops.accent },
  { role: 'deploy', accent: ROOMS.hangar.accent },
];

/** The radar: a sweep turning at a steady pace and a blip per Site instance, in its squad's colour, fading after the sweep. */
function paintRadar(painter: Painter, stage: StageView, cx: number, cy: number, r: number): void {
  const { now } = stage;
  const up = isUp(stage, 'compute');
  disc(painter, CYAN.deep, cx, cy, r);
  disc(painter, HULL.dark, cx, cy, r - 1);
  for (let k = 0; k < 24; k++) {
    const a = (k * TAU) / 24;
    dot(painter, CYAN.base, cx + Math.cos(a) * (r / 2), cy + Math.sin(a) * (r / 2));
  }
  painter.rect(CYAN.deep, cx - r + 1, cy, r * 2 - 1, 1);
  painter.rect(CYAN.deep, cx, cy - r + 1, 1, r * 2 - 1);
  if (!up) return;
  const sweep = (now / RADAR_SECONDS) * TAU;
  for (let trail = 3; trail >= 0; trail--) {
    const a = sweep - trail * 0.14;
    painter.withAlpha(trail === 0 ? 1 : 0.45 / trail, () => {
      for (let reach = 1; reach < r; reach++)
        dot(painter, CYAN.bright, cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
    });
  }
  for (const site of sitesOf(stage)) {
    const h = hashOf(site.id);
    const a = ((h % 360) / 360) * TAU;
    const reach = 4 + (mix(h, 1) % (r - 7));
    const since = ((((sweep - a) % TAU) + TAU) % TAU) / TAU;
    painter.withAlpha(Math.max(0.25, 1 - since), () =>
      dot(painter, clientStyle(site.client).colour, cx + Math.cos(a) * reach - 0.5, cy + Math.sin(a) * reach - 0.5, 2),
    );
  }
}

/** The SCRD scoreboard, live while the ops floor is up. */
function paintScore({ R, T }: Pen, stage: StageView, x: number, y: number, w: number): void {
  const mid = x + w / 2;
  const up = isUp(stage, 'compute');
  T('SCRD', x + 3, y + 9, STEEL.light);
  R(up && wave(stage.now, 1.6) > 0.5 ? LAMP.ok : UNLIT, x + w - 6, y + 4, 3, 3);
  R(STEEL.dark, x + 3, y + 12, w - 6, 1);
  if (!up) {
    T('--', mid, y + 27, STEEL.base, 'centre', true);
    return;
  }
  const { sport, a, b } = scoreAt(stage.now);
  T(`${a}-${b}`, mid, y + 27, CYAN.hot, 'centre', true);
  T(SPORT_NAMES[sport].toUpperCase(), mid, y + 39, CYAN.bright, 'centre');
}

/** A load bar per VM, in its room's accent: CPU across the bar, red and full while the VM is down. */
function paintLoad({ R }: Pen, stage: StageView, x: number, y: number, w: number): void {
  LOAD_ROWS.forEach(({ role, accent }, i) => {
    const vm = vmOf(stage, role);
    const ry = y + 4 + i * 10;
    const track = w - 12;
    R(accent, x + 3, ry, 3, 5);
    R(INK, x + 8, ry, track, 5);
    if (!vm) return;
    if (!vm.up) {
      R(ALARM.dark, x + 8, ry + 1, track, 3);
      return;
    }
    const fill = Math.max(1, Math.round((track * vm.cpu) / 100));
    R(vm.cpu > 80 ? LAMP.warn : CYAN.bright, x + 8, ry + 1, fill, 3);
  });
}

const paintTacticalWall: DecorFn = (painter, stage) => {
  const pn = pen(painter);
  const glass = screenFrame(pn, TACTICAL_WALL, HULL.dark);
  // Mounting brackets on the wall above it.
  for (const bx of [TACTICAL_WALL.x + 20, TACTICAL_WALL.x + TACTICAL_WALL.w - 24]) {
    pn.R(STEEL.dark, bx, TACTICAL_WALL.y - 3, 4, 3);
  }
  if (stage.host === null) return;
  const panel = ([dx, w]: readonly [number, number]): readonly [number, number] => [glass.x + dx, w];
  const [rx, rw] = panel(PANELS.radar);
  const [sx, sw] = panel(PANELS.score);
  const [lx, lw] = panel(PANELS.load);
  for (const mx of [sx - 1, lx - 1]) pn.R(STEEL.dark, mx, glass.y, 1, glass.h);
  paintRadar(painter, stage, rx + Math.floor(rw / 2), glass.y + Math.floor(glass.h / 2), Math.floor(glass.h / 2) - 1);
  paintScore(pn, stage, sx, glass.y, sw);
  paintLoad(pn, stage, lx, glass.y, lw);
  // The quiet watch: the wall runs at half brightness.
  if (jarvisState(stage) === 'night') painter.withAlpha(0.45, () => pn.R(INK, glass.x, glass.y, glass.w, glass.h));
};

/* --------------------------------------------------------------- holo-table */

const GLOBE = { cx: HOLO_X, cy: 186, r: 11 } as const;
const HOLO_TOP = 208;

/** A wireframe globe turning over the table: meridians and two latitudes, dots only. */
function paintGlobe(painter: Painter, now: number, colour: string): void {
  const { cx, cy, r } = GLOBE;
  for (let m = 0; m < 3; m++) {
    const half = r * Math.cos(now * 0.9 + (m * Math.PI) / 3);
    for (let k = 0; k < 20; k++) {
      const a = (k * TAU) / 20;
      dot(painter, colour, cx + Math.cos(a) * half, cy + Math.sin(a) * r);
    }
  }
  for (const lat of [-0.5, 0, 0.5]) {
    const half = r * Math.sqrt(1 - lat * lat);
    for (let k = 0; k < 16; k++) {
      const a = (k * TAU) / 16;
      dot(painter, colour, cx + Math.cos(a) * half, cy + lat * r + Math.sin(a) * 1.5);
    }
  }
}

/** The holo-table: a bench against the wall throwing the lab's globe. Brighter, with a marker, while someone studies it. */
const paintHoloTable: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { now } = stage;
  const x0 = HOLO_TABLE.x + 1;
  const w = HOLO_TABLE.w - 2;
  // The bench: legs down behind the stations, a top with a lit rim, the emitter in the middle.
  for (const lx of [x0, x0 + w - 3]) R(STEEL.dark, lx, HOLO_TOP + 3, 2, 17);
  R(INK, x0, HOLO_TOP, w, 4);
  R(STEEL.base, x0 + 1, HOLO_TOP, w - 2, 2);
  const on = isUp(stage, 'compute');
  R(on ? CYAN.bright : UNLIT, x0 + 2, HOLO_TOP + 2, w - 4, 1);
  R(on ? CYAN.hot : UNLIT, HOLO_X - 2, HOLO_TOP - 1, 5, 1);
  if (!on) return;
  const studied = stage.busyBreakSpots.has(HOLO_INDEX);
  const strength = studied ? 0.9 : 0.55;
  // The beam: a soft cone from the emitter up to the globe.
  painter.withAlpha(0.16 * strength + 0.04 * wave(now, 2.2), () => {
    for (let y = GLOBE.cy; y < HOLO_TOP - 1; y++) {
      const half = 2 + Math.round(((HOLO_TOP - y) / (HOLO_TOP - GLOBE.cy)) * (GLOBE.r - 2));
      R(CYAN.bright, HOLO_X - half, y, half * 2 + 1, 1);
    }
  });
  painter.withAlpha(0.2 * strength, () => disc(painter, CYAN.base, GLOBE.cx, GLOBE.cy, GLOBE.r));
  painter.withAlpha(strength, () => paintGlobe(painter, now, studied ? CYAN.hot : CYAN.bright));
  if (studied) {
    // A marker on the map, bobbing: the hero has found what they were after.
    const bob = Math.round(wave(now, 1.2));
    R(AMBER.glow, HOLO_X + 3, GLOBE.cy - 4 - bob, 2, 2);
    R(AMBER.hot, HOLO_X + 3, GLOBE.cy - 2 - bob, 1, 2);
  }
};

/* ----------------------------------------------------------- alarm beacons */

const BEACON_SECONDS = 0.9;

/** One alarm beacon: a dark red lens at rest; on all hands it turns, throwing its beam across the wall. */
function paintBeacon(painter: Painter, cx: number, stage: StageView): void {
  const { R } = pen(painter);
  const top = BEACON_TOP;
  R(STEEL.dark, cx - 2, top, 5, 1);
  R(STEEL.dark, cx, top + 1, 1, 1);
  R(STEEL.base, cx - 3, top + 2, 7, 1);
  const turning = alarmOn(stage);
  R(turning ? ALARM.dark : ALARM.deep, cx - 1, top + 3, 3, 1);
  R(turning ? ALARM.dark : ALARM.deep, cx - 2, top + 4, 5, 3);
  if (!turning) {
    R(STEEL.light, cx - 1, top + 4, 1, 1);
    return;
  }
  const a = (stage.now / BEACON_SECONDS) * TAU;
  const across = Math.cos(a);
  const facing = Math.sin(a);
  // The lamp inside the lens, travelling round with the mirror.
  R(ALARM.base, cx - 2, top + 4, 5, 3);
  R(ALARM.white, cx + Math.round(across * 2), top + 3, 1, 4);
  // Facing us, the dome blazes; side on, the beam lies along the wall.
  if (facing > 0.6) painter.withAlpha(0.35 * facing, () => disc(painter, ALARM.light, cx, top + 5, 4));
  const side = across > 0 ? 1 : -1;
  painter.withAlpha(0.4 * Math.abs(across), () => {
    for (let step = 0; step < 4; step++) {
      const len = 5;
      const bx = side > 0 ? cx + 3 + step * len : cx - 2 - (step + 1) * len;
      R(ALARM.light, bx, top + 4 - Math.floor(step / 2), len, 3 + Math.floor(step / 2) * 2);
    }
  });
}

const paintBeacons: DecorFn = (painter, stage) => {
  for (const x of BEACON_XS) paintBeacon(painter, x, stage);
};

/* ------------------------------------------------------------ the gate field */

/** The field across the gate: a soft cyan sheet with sparks climbing it, down while the ops floor is. */
const paintGateField: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { x, y, w, h } = GATE;
  const on = isUp(stage, 'compute');
  // The emitters under the lintel and at the threshold.
  for (const ey of [y, y + h - 1]) R(on ? CYAN.bright : UNLIT, x + 1, ey, w - 2, 1);
  if (!on) return;
  const { now } = stage;
  painter.withAlpha(0.14 + 0.1 * wave(now, 2.4), () => R(CYAN.bright, x, y + 1, w, h - 2));
  painter.withAlpha(0.7, () => {
    for (let c = 0; c < w; c += 2) {
      const climb = (now * 14 + c * 9) % (h - 4);
      R(CYAN.hot, x + c, y + h - 3 - climb, 1, 2);
    }
  });
};

/* --------------------------------------------------------------- the hangar */

const CRATE = { w: 7, h: 6, gap: 1 } as const;
const SHELF_STEP = 15;

const SHELVES = 3;
/** How many crates fit side by side on one of a rack's shelves. */
const perShelf = (rack: Rect): number => Math.floor((rack.w - 3) / (CRATE.w + CRATE.gap));

/** A gear rack: steel uprights and three shelves, each holding `crates[shelf]` (colours, left to right). */
function paintRack(painter: Painter, rack: Rect, crates: readonly (readonly string[])[]): void {
  const { R } = pen(painter);
  const { x, y, w, h } = rack;
  R(INK, x, y, 2, h);
  R(INK, x + w - 2, y, 2, h);
  R(STEEL.base, x, y, 1, h);
  R(STEEL.base, x + w - 2, y, 1, h);
  for (let shelf = 0; shelf < SHELVES; shelf++) {
    const sy = y + 12 + shelf * SHELF_STEP;
    R(STEEL.light, x, sy, w, 1);
    R(STEEL.dark, x, sy + 1, w, 1);
    (crates[shelf] ?? []).forEach((colour, i) => {
      const cx = x + 2 + i * (CRATE.w + CRATE.gap);
      R(INK, cx, sy - CRATE.h, CRATE.w, CRATE.h);
      R(colour, cx + 1, sy - CRATE.h + 1, CRATE.w - 2, CRATE.h - 1);
      R(STEEL.shine, cx + 1, sy - CRATE.h + 3, CRATE.w - 2, 1);
    });
  }
}

/** The gear racks: a crate for every Site instance on the floor, in its squad's colour, filling the top shelves of both racks first. */
const paintGearRacks: DecorFn = (painter, stage) => {
  const colours = sitesOf(stage).map((site) => clientStyle(site.client).colour);
  const row = GEAR_RACKS.reduce((n, rack) => n + perShelf(rack), 0);
  let start = 0;
  for (const rack of GEAR_RACKS) {
    const shelves = Array.from({ length: SHELVES }, (_, shelf) =>
      colours.slice(shelf * row + start, shelf * row + start + perShelf(rack)),
    );
    paintRack(painter, rack, shelves);
    start += perShelf(rack);
  }
};

/** Is the deploy runner at work? The orb's answer (D5), so the hangar and JARVIS never disagree. */
export const deploying = (stage: StageView): boolean => jarvisState(stage) === 'deploy';

const CHASE_RATE = 9;

/**
 * The runner lights along the top of the hangar wall: dark while the hangar is down, a steady green
 * ready lamp while the runner idles, and a chase running to the door while it deploys.
 */
const paintRunnerLights: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { x, y, count, step } = RUNNER_LIGHTS;
  const up = isUp(stage, 'deploy');
  const running = up && deploying(stage);
  const head = Math.floor(stage.now * CHASE_RATE);
  R(INK, x - 1, y - 1, (count - 1) * step + 5, 4);
  for (let i = 0; i < count; i++) {
    const lx = x + i * step;
    let colour: string = up ? HULL.light : UNLIT;
    if (running) {
      const lag = (((head - i) % 5) + 5) % 5;
      colour = lag === 0 ? ROOMS.hangar.accent : lag === 1 ? AMBER.rim : HULL.light;
    } else if (up && i === 0) {
      colour = LAMP.ok;
    }
    R(colour, lx, y, 3, 2);
  }
};

/** The blast door, rolled up into its housing over the hangar door. Its lamp turns while the runner deploys. */
const paintBlastDoor: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { x, y, w, h } = BLAST_DOOR;
  R(INK, x, y, w, h);
  R(HULL.trim, x + 1, y + 1, w - 1, h - 5);
  // Hazard chevrons along the door's leading edge.
  for (let i = 0; i < w - 1; i++) {
    for (let row = 0; row < 3; row++) {
      R((i + row) % 4 < 2 ? ROOMS.hangar.accent : INK, x + 1 + i, y + h - 4 + row, 1, 1);
    }
  }
  // The rail the door runs down, at the wall's edge, clear of the opening.
  const rail = BANDS[DECK.ground].back;
  R(STEEL.dark, x + w - 3, y + h, 2, rail - y - h);
  R(STEEL.base, x + w - 3, y + h, 1, rail - y - h);
  // The warning lamp: turning amber while a deploy rolls, dark at rest.
  const running = isUp(stage, 'deploy') && deploying(stage);
  const lit = running && Math.floor(stage.now * 4) % 2 === 0;
  R(INK, x + 2, y - 3, 5, 3);
  R(running ? (lit ? LAMP.warn : AMBER.rim) : UNLIT, x + 3, y - 2, 3, 2);
};

/* ------------------------------------------------------------------ the roof */

/** Half the shield's width on row `dy` from its top: straight sides, then a point. */
const shieldHalf = (dy: number): number => (dy < 17 ? 10 : 10 - Math.round((dy - 16) * 1.1));

/** The Nines' emblem: a steel shield with a gold 9 and five pips, one for each nine of uptime. Lit after dark. */
const paintEmblem: DecorFn = (painter, { hour }) => {
  const { R, T } = pen(painter);
  const cx = EMBLEM.x + 11;
  const top = EMBLEM.y;
  const night = nightFactor(hour);
  if (night > 0) painter.withAlpha(0.22 * night, () => disc(painter, AMBER.glow, cx, top + 13, 14));
  // Its stand, down to the roof deck.
  R(INK, cx - 1, top + 24, 3, EMBLEM.y + EMBLEM.h - top - 24);
  for (let dy = 0; dy < 26; dy++) {
    const half = shieldHalf(dy);
    if (half < 0) break;
    R(INK, cx - half - 1, top + dy, half * 2 + 3, 1);
  }
  R(INK, cx - 11, top - 1, 23, 1);
  // A steel rim round a navy field.
  for (let dy = 0; dy < 25; dy++) {
    const half = shieldHalf(dy) - 1;
    if (half < 0) break;
    R(dy < 1 ? STEEL.shine : STEEL.light, cx - half - 1, top + dy, half * 2 + 3, 1);
  }
  for (let dy = 2; dy < 23; dy++) {
    const half = shieldHalf(dy) - 2;
    if (half < 0) break;
    R(HULL.light, cx - half, top + dy, half * 2 + 1, 1);
  }
  for (let pip = 0; pip < 5; pip++) R(CYAN.bright, cx - 8 + pip * 4, top + 3, 2, 2);
  T('9', cx + 1, top + 17, AMBER.glow, 'centre', true);
  // The name board beside it.
  const { x, y, w, h, text } = NAME_BOARD;
  R(INK, x, y, w, h);
  R(HULL.light, x + 1, y + 1, w - 2, h - 2);
  for (const leg of [x + 6, x + w - 9]) R(INK, leg, y + h, 3, EMBLEM.y + EMBLEM.h - y - h);
  T(text, x + w / 2, y + 10, PAPER, 'centre');
};

const MAST_SECONDS = 1.6;

/** The mast beacon: a white wink every couple of seconds, red and twice as quick on all hands. A soft halo after dark. */
const paintMastBeacon: DecorFn = (painter, stage) => {
  const { R } = pen(painter);
  const { x, y } = MAST_LAMP;
  const alarm = alarmOn(stage);
  const period = alarm ? MAST_SECONDS / 2 : MAST_SECONDS;
  const lit = stage.host !== null && stage.now % period < period * 0.25;
  const colour = alarm ? ALARM.base : PAPER;
  R(INK, x - 1, y - 1, 5, 4);
  R(lit ? colour : STEEL.dark, x, y, 3, 2);
  const night = nightFactor(stage.hour);
  if (lit && night > 0) painter.withAlpha(0.3 * night, () => disc(painter, colour, x + 1, y + 1, 4));
};

/* ------------------------------------------------------------------ exports */

/** Painted in the back layer, after the structure, in this order. */
export const GROUND_DECK_BACK: readonly DecorFn[] = [
  paintEmblem,
  paintMastBeacon,
  paintGateField,
  paintOpsClock,
  paintDispatchSign,
  paintHeartbeat,
  paintTacticalWall,
  paintHoloTable,
  paintGearRacks,
  paintRunnerLights,
  paintBlastDoor,
  paintBeacons,
];

/** Everything on the ground deck hangs on a wall or stands on the roof, so nothing needs depth-sorting. */
export const GROUND_DECK_PROPS: readonly Prop[] = [];

/* ------------------------------------------------------------------ hotspots */

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export function tacticalTip(stage: StageView): Tip {
  const detail =
    'SCRD is our own scoring platform: mostly squash, and now racquetball too. The radar shows a blip for every Site instance in its squad colour; the bars are each VM by CPU.';
  if (!isUp(stage, 'compute')) return { title: 'Tactical wall', detail, status: 'SCRD is offline', severity: 'crit' };
  const { sport, a, b } = scoreAt(stage.now);
  return { title: 'Tactical wall', detail, status: `${SPORT_NAMES[sport]} ${a}-${b}`, severity: 'ok' };
}

export const heartbeatTip = ({ findings }: StageView): Tip => ({
  title: 'Healthchecks.io',
  detail:
    "The heartbeat monitor: the lab's dead man's switch. The lab pings it every 15 minutes; if the pings stop or verify goes critical, Discord hears about it.",
  status: findings.crit > 0 ? 'Failing' : 'Pinging',
  severity: findings.crit > 0 ? 'crit' : 'ok',
});

export const clockTip = ({ hour }: StageView): Tip => ({
  title: 'Ops clock',
  detail: `HQ time. The jet flies the nightly backup at 02:30, and the quiet watch runs from ${two(QUIET_HOURS.from)}:00 until ${two(QUIET_HOURS.until)}:00.`,
  status: clockText(hour),
  severity: 'ok',
});

export function holoTip(stage: StageView): Tip {
  const detail =
    'The holo-table: the lab at a glance, one Proxmox host and its four VMs. A break spot for the heroes on watch.';
  if (stage.vms.length === 0)
    return { title: 'Holo-table', detail, status: 'Waiting on the first Snapshot', severity: 'ok' };
  const down = stage.vms.filter((vm) => !vm.up).length;
  const status = down > 0 ? `${plural(down, 'VM')} down` : `All ${stage.vms.length} VMs up`;
  return { title: 'Holo-table', detail, status, severity: down > 0 ? 'crit' : 'ok' };
}

export const beaconTip = ({ findings }: StageView): Tip => ({
  title: 'Discord alerts',
  detail:
    'The alarm beacons. Critical findings page #alerts in Discord, warnings go to #lab-digest; the beacons turn when JARVIS calls all hands.',
  status: findings.crit > 0 ? plural(findings.crit, 'critical finding') : 'Quiet',
  severity: findings.crit > 0 ? 'crit' : 'ok',
});

export const gateTip = (stage: StageView): Tip => ({
  title: 'The gate',
  detail:
    'Cloudflare Tunnel: the lab has no inbound ports. Citizens (HTTP requests) come in through the tunnel, past the Tunnel Twins, to Switchboard.',
  status: isUp(stage, 'compute') ? 'Field up' : 'Field down',
  severity: isUp(stage, 'compute') ? 'ok' : 'crit',
});

export function rackTip(stage: StageView): Tip {
  const detail =
    'Gear racks on sls-deploy: the runner that builds images, deploys and seeds lab Site instances. A crate for each Site instance on the ops floor.';
  const runner = runnerOf(stage);
  if (!runner) return { title: 'Deploy runner', detail, status: 'No reading yet', severity: 'ok' };
  const { status, severity } = HEALTH_WORDS[runner.health];
  return { title: runner.name, detail, cpu: runner.cpu, mem: runner.mem, status, severity };
}

export const emblemTip = (): Tip => ({
  title: 'The Nines',
  detail:
    'The team, named for five nines of uptime: a pip on the shield for each nine. Every sworn hero wears the mask.',
  status: 'Flying over the HQ',
  severity: 'ok',
});

export const GROUND_DECK_HOTSPOTS: readonly Hotspot[] = [
  { rect: TACTICAL_WALL, tip: tacticalTip },
  { rect: HEARTBEAT_MONITOR, tip: heartbeatTip },
  { rect: OPS_CLOCK, tip: clockTip },
  { rect: { x: HOLO_TABLE.x, y: HOLO_TABLE.y, w: HOLO_TABLE.w, h: 42 }, tip: holoTip },
  ...BEACON_XS.map((x): Hotspot => ({ rect: beaconRect(x), tip: beaconTip })),
  { rect: GATE, tip: gateTip },
  ...GEAR_RACKS.map((rect): Hotspot => ({ rect, tip: rackTip })),
  { rect: TEAM_EMBLEM, tip: emblemTip },
];
