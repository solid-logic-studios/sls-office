import type { Painter } from '../../contract/painter.ts';
import type { Health, ServiceWorkload } from '../../contract/snapshot.ts';
import type { DecorFn, Hotspot, Prop, Rect, StageView, Tip } from '../../contract/theme.ts';
import { mysqlTip, postgresTip } from '../office/hotspots.ts';
import { nightFactor } from '../shared/sky.ts';
import { pen, type Pen } from '../shared/pen.ts';
import { isAlarm, podCount } from './jarvis-state.ts';
import { TAU, disc, dot, orbitPoint, wave, type Orbit } from './kit.ts';
import { BANDS, COUCH, DECK } from './geometry.ts';
import { HQ_LAYOUT } from './layout.ts';
import { ciDown, isUp, plural, vmOf } from './lab.ts';
import { ALARM, AMBER, COUCH_COLOURS, CYAN, HULL, INK, LAMP, PAPER, ROOMS, STEEL, UNLIT } from './palette.ts';

/**
 * Slice 4: the upper deck's dressing (docs/design/hq-theme.md, sections 4, 6 and 10). Original pixel art,
 * drawn from rectangles and animated from `stage.now` alone.
 *
 * - Rookie bay (the CI runner): the suit-up tube the rookies step out of, glowing while any pod runs, and
 *   the mission board with one row per rookie.
 * - Archive vault (the data VM): Hulk's two lockers, a drawer pulled out and lit while Hulk has that
 *   store open, and the strongroom door, standing open while the backup is out on the jet.
 * - Command deck: the brew station and the trophy shelf.
 * - Rec room: the big screen over the couch and the punching bag, which swings while someone is at it.
 * - An alarm beacon under the ceiling of each room that has none of JARVIS's own red.
 *
 * Everything hangs on the back walls: nothing reaches the floor people walk on (y 121 and below), the
 * doorways, the orb or the readout.
 */

/* ------------------------------------------------------------------- boards */

/** The top of the floor: the dressing stays on the back wall, above it. */
export const BACK_WALL_FOOT = 121;

export const SUIT_UP_TUBE: Rect = { x: 14, y: 62, w: 13, h: 58 };
export const MISSION_BOARD: Rect = { x: 40, y: 62, w: 94, h: 36 };
/** The two lockers with their name boards: PostgreSQL in front of store 0, MySQL in front of store 1. */
export const POSTGRES_LOCKER: Rect = { x: 148, y: 58, w: 34, h: 62 };
export const MYSQL_LOCKER: Rect = { x: 216, y: 58, w: 34, h: 62 };
/** In store order, so a locker's index is the store Hulk opens. */
export const LOCKERS: readonly { rect: Rect; label: string }[] = [
  { rect: POSTGRES_LOCKER, label: 'PGSQL' },
  { rect: MYSQL_LOCKER, label: 'MYSQL' },
];
/** The strongroom door's centre, between the lockers over Hulk's desk, and its hover target (frame, open door and lamp). */
const STRONGROOM_DOOR = { cx: 199, cy: 82 } as const;
export const STRONGROOM: Rect = { x: 183, y: 69, w: 30, h: 32 };
export const BREW_STATION: Rect = { x: 276, y: 94, w: 25, h: 27 };
export const TROPHY_SHELF: Rect = { x: 414, y: 94, w: 28, h: 18 };
export const TELLY: Rect = { x: 486, y: 62, w: 46, h: 33 };
export const PUNCHING_BAG: Rect = { x: 548, y: 45, w: 14, h: 76 };

/** The words on the mission board and the big screen, so a test can hold every board to its text. */
export const MISSION_TITLE = 'MISSIONS';
export const ALERT_TEXT = 'ALERT';
export const BREW_TEXT = 'BREW';

/* ------------------------------------------------------------------ reading */

/** Whether anyone has arrived at a break spot of `kind` (the stage reports busy spots by index). */
export const spotBusy = (stage: StageView, kind: string): boolean =>
  HQ_LAYOUT.breakSpots.some((spot, i) => spot.kind === kind && stage.busyBreakSpots.has(i));

/** The health of the data VM's `index`th engine, in Snapshot order, or `null` with no reading. */
function engineHealth(stage: StageView, index: number): Health | null {
  const engines = vmOf(stage, 'data')?.workloads.filter((w): w is ServiceWorkload => w.kind === 'engine') ?? [];
  return engines[index]?.health ?? null;
}

/** A locker's lamp: by its engine's health while the data VM is up, dark otherwise. */
function healthLamp(health: Health | null, up: boolean): string {
  if (!up) return UNLIT;
  if (health === 'unhealthy' || health === 'down') return ALARM.base;
  return health === 'starting' ? LAMP.warn : LAMP.ok;
}

/** Rookies on a mission, as many as there are benches. */
const ROOKIE_ROWS = 3;

/* ---------------------------------------------------------------- rookie bay */

const MINT = ROOMS.rookieBay.accent;

/** The suit-up tube in the left wall: rings of light rise through it while any rookie is out on a mission. */
export function paintSuitUpTube(painter: Painter, stage: StageView): void {
  const { R } = pen(painter);
  const { x, y, w, h } = SUIT_UP_TUBE;
  const up = isUp(stage, 'ci');
  const active = up && podCount(stage.vms) > 0;
  const glassTop = y + 6;
  const glassBottom = y + h - 7;
  // The glass, with the room showing dimly through it.
  R(HULL.dark, x + 1, glassTop, w - 2, glassBottom - glassTop);
  if (active) {
    const breath = wave(stage.now, 1.8);
    painter.withAlpha(0.1 + 0.08 * breath, () => R(MINT, x, y, w + 2, h));
    R(CYAN.deep, x + 1, glassTop, w - 2, glassBottom - glassTop);
    painter.withAlpha(0.45 + 0.25 * breath, () => R(MINT, x + 1, glassTop, w - 2, glassBottom - glassTop));
    for (let k = 0; k < 3; k++) {
      const ry = glassBottom - 1 - ((stage.now * 18 + k * 15) % (glassBottom - glassTop));
      R(PAPER, x + 2, ry, w - 4, 1);
    }
  }
  R(up ? STEEL.light : STEEL.dark, x + 2, glassTop, 1, glassBottom - glassTop);
  R(STEEL.dark, x + w - 3, glassTop, 1, glassBottom - glassTop);
  // Steel caps top and bottom, the bottom one a pad with the room's accent round it.
  R(INK, x, y, w, 6);
  R(STEEL.base, x, y + 1, w, 4);
  R(STEEL.shine, x, y + 1, w, 1);
  R(active ? MINT : UNLIT, x + 3, y + 3, w - 6, 1);
  R(INK, x, glassBottom, w, 7);
  R(STEEL.base, x, glassBottom + 1, w, 5);
  R(up ? MINT : STEEL.dark, x, glassBottom + 1, w, 1);
}

/** The mission board: one row per rookie, a bar filling while that rookie's pod runs its job. */
function paintMissionBoard(painter: Painter, stage: StageView): void {
  const { R, T } = pen(painter);
  const { x, y, w, h } = MISSION_BOARD;
  const up = isUp(stage, 'ci');
  const pods = up ? podCount(stage.vms) : 0;
  R(INK, x, y, w, h);
  R(STEEL.dark, x + 1, y + 1, w - 2, h - 2);
  R(up ? HULL.dark : UNLIT, x + 2, y + 2, w - 4, h - 4);
  if (!up) return;
  R(MINT, x + 2, y + 2, w - 4, 1);
  T(MISSION_TITLE, x + 4, y + 11, MINT);
  T(`${pods}/${ROOKIE_ROWS}`, x + w - 4, y + 11, pods > 0 ? PAPER : STEEL.base, 'right');
  for (let i = 0; i < ROOKIE_ROWS; i++) {
    const ry = y + 16 + i * 7;
    const running = i < pods;
    const barX = x + 6;
    const barW = w - 20;
    R(running ? CYAN.deep : UNLIT, barX, ry, barW, 3);
    if (running) {
      // Each rookie's job fills at its own pace and starts over: lint, test, build, again.
      const fill = Math.floor(((stage.now / (5 + i * 1.3) + i * 0.37) % 1) * barW);
      R(i % 2 ? CYAN.bright : MINT, barX, ry, fill, 3);
      R(PAPER, barX + fill, ry, 1, 3);
    } else {
      for (let d = 2; d < barW; d += 6) R(STEEL.dark, barX + d, ry + 1, 3, 1);
    }
    const lamp = running ? (wave(stage.now, 1.1, i) > 0.5 ? LAMP.ok : LAMP.warn) : UNLIT;
    R(lamp, x + w - 10, ry, 4, 3);
  }
}

/* ------------------------------------------------------------- archive vault */

const VIOLET = ROOMS.archive.accent;
/** Which of the four drawers Hulk pulls out: the one at arm's height. */
const PULLED_DRAWER = 2;

/** A locker: a name board, four drawers and a lamp for its engine. The drawer pulls out and glows while Hulk has it open. */
function paintLocker(
  painter: Painter,
  stage: StageView,
  { rect, label }: (typeof LOCKERS)[number],
  index: number,
): void {
  const pn = pen(painter);
  const { R, T } = pn;
  const up = isUp(stage, 'data');
  const open = up && stage.openStores.has(index);
  const lx = rect.x + 2;
  const top = rect.y + 11;
  const lw = rect.w - 4;
  // The name board.
  R(INK, rect.x, rect.y, rect.w, 9);
  T(label, rect.x + rect.w / 2, rect.y + 8, up ? VIOLET : STEEL.base, 'centre');
  if (open)
    painter.withAlpha(0.12 + 0.1 * wave(stage.now, 1.4), () =>
      R(CYAN.bright, rect.x, top - 2, rect.w, rect.y + rect.h - top + 2),
    );
  // The body: a steel top, four drawers and a plinth.
  R(INK, lx, top, lw, BACK_WALL_FOOT - 1 - top);
  R(HULL.trim, lx + 1, top + 1, lw - 2, BACK_WALL_FOOT - 3 - top);
  R(STEEL.base, lx, top, lw, 2);
  R(healthLamp(engineHealth(stage, index), up), lx + lw - 5, top + 3, 2, 2);
  for (let i = 0; i < 4; i++) {
    const dy = top + 6 + i * 11;
    R(HULL.light, lx + 2, dy, lw - 4, 9);
    R(STEEL.dark, lx + 2, dy + 8, lw - 4, 1);
    R(VIOLET, lx + 4, dy + 2, 5, 3);
    R(STEEL.shine, lx + 12, dy + 3, 6, 1);
  }
  if (open) paintPulledDrawer(pn, lx, top + 6 + PULLED_DRAWER * 11, lw, stage.now);
}

/** Both lockers, in store order. */
export const paintLockers: DecorFn = (painter, stage) =>
  LOCKERS.forEach((locker, i) => paintLocker(painter, stage, locker, i));

/** A drawer pulled out towards the viewer: a dark slot behind it, its records lit along the top. */
function paintPulledDrawer({ R }: Pen, lx: number, dy: number, lw: number, now: number): void {
  R(INK, lx + 2, dy, lw - 4, 9);
  R(INK, lx, dy + 2, lw, 11);
  R(HULL.light, lx + 1, dy + 3, lw - 2, 9);
  R(VIOLET, lx + 4, dy + 5, 5, 3);
  R(STEEL.shine, lx + 12, dy + 7, 6, 1);
  R(ROOMS.archive.shade, lx + 1, dy + 2, lw - 2, 2);
  const flick = Math.floor(now * 6);
  for (let i = 0; i < 6; i++) R((flick + i) % 6 === 0 ? PAPER : CYAN.bright, lx + 2 + i * 4, dy, 2, 2);
}

/** The strongroom between the lockers: sealed, or swung open with its shelf bare while the backup is away on the jet. */
function paintStrongroom(painter: Painter, stage: StageView): void {
  const { R } = pen(painter);
  const { cx, cy } = STRONGROOM_DOOR;
  const up = isUp(stage, 'data');
  // A square steel frame set in the wall, hinged on the left, round the door.
  R(INK, cx - 13, cy - 13, 27, 27);
  R(STEEL.dark, cx - 12, cy - 12, 25, 25);
  R(STEEL.base, cx - 12, cy - 12, 25, 1);
  for (const hy of [cy - 8, cy + 6]) R(STEEL.light, cx - 13, hy, 2, 3);
  disc(painter, INK, cx, cy, 11);
  if (stage.vaultOpen) {
    // Inside: a bare shelf, the strongbox away on the jet. The door stands open against the frame, edge on.
    disc(painter, HULL.dark, cx, cy, 10);
    R(STEEL.dark, cx - 7, cy + 3, 15, 1);
    R(INK, cx - 7, cy + 4, 15, 1);
    R(INK, cx - 16, cy - 11, 4, 23);
    R(STEEL.base, cx - 15, cy - 10, 2, 21);
    R(STEEL.shine, cx - 15, cy - 10, 1, 21);
  } else {
    disc(painter, STEEL.base, cx, cy, 10);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16;
      dot(painter, STEEL.shine, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
    }
    // The wheel: a rim, four spokes and a knob at each end.
    disc(painter, STEEL.light, cx, cy, 5);
    disc(painter, STEEL.base, cx, cy, 4);
    R(STEEL.light, cx - 6, cy, 13, 1);
    R(STEEL.light, cx, cy - 6, 1, 13);
    for (const [kx, ky] of [
      [cx - 7, cy],
      [cx + 6, cy],
      [cx, cy - 7],
      [cx, cy + 6],
    ] as const) {
      R(INK, kx, ky, 2, 2);
      R(STEEL.shine, kx, ky, 1, 1);
    }
    disc(painter, STEEL.shine, cx, cy, 1);
  }
  const lamp = !up ? UNLIT : stage.vaultOpen ? (wave(stage.now, 1.6) > 0.5 ? LAMP.warn : AMBER.rim) : LAMP.ok;
  R(INK, cx - 2, cy + 14, 5, 4);
  R(lamp, cx - 1, cy + 15, 3, 2);
}

/* -------------------------------------------------------------- command deck */

/** The brew station: a machine and two mugs on a counter, steaming while someone is on a coffee break. */
export function paintBrewStation(painter: Painter, stage: StageView): void {
  const { R, T } = pen(painter);
  const { x, y, w } = BREW_STATION;
  const busy = spotBusy(stage, 'brew');
  const counterTop = y + 12;
  // The counter, with its sign on the front.
  R(INK, x, counterTop, w, BACK_WALL_FOOT - counterTop);
  R(HULL.trim, x + 1, counterTop + 1, w - 2, BACK_WALL_FOOT - counterTop - 2);
  R(STEEL.base, x, counterTop, w, 2);
  R(STEEL.shine, x, counterTop, w, 1);
  T(BREW_TEXT, x + w / 2, counterTop + 11, AMBER.glow, 'centre');
  // The machine: a dark body, its lamp, the spout and a cup under it.
  R(INK, x + 2, y, 11, 12);
  R(STEEL.dark, x + 3, y + 1, 9, 10);
  R(busy ? AMBER.glow : AMBER.ember, x + 9, y + 2, 2, 2);
  R(STEEL.shine, x + 5, y + 6, 4, 1);
  R(PAPER, x + 6, y + 9, 3, 3);
  if (busy && Math.floor(stage.now * 8) % 2 === 0) R(AMBER.rim, x + 7, y + 7, 1, 2);
  // Two mugs, the founders' gold band on each.
  for (const mx of [x + 15, x + 20]) {
    R(PAPER, mx, counterTop - 4, 3, 4);
    R(AMBER.glow, mx, counterTop - 3, 3, 1);
  }
  if (!busy) return;
  // Steam: a few pixels drifting up off the mugs.
  for (let k = 0; k < 4; k++) {
    const rise = (stage.now * 5 + k * 2.5) % 9;
    painter.withAlpha(1 - rise / 9, () =>
      dot(painter, PAPER, x + 16 + (k % 2) * 5 + (rise > 4 ? 1 : 0), counterTop - 5 - rise),
    );
  }
}

/** The trophy shelf: the cup from the first client, and a medal. Gold, so it catches JARVIS's light. */
export function paintTrophyShelf(painter: Painter, stage: StageView): void {
  const { R } = pen(painter);
  const { x, y, w, h } = TROPHY_SHELF;
  const shelf = y + h - 4;
  R(STEEL.base, x, shelf, w, 2);
  R(STEEL.shine, x, shelf, w, 1);
  R(STEEL.dark, x + 3, shelf + 2, 2, 2);
  R(STEEL.dark, x + w - 5, shelf + 2, 2, 2);
  // The cup: a base, a stem, a bowl with two handles.
  const cx = x + 3;
  R(AMBER.rim, cx, shelf - 2, 9, 2);
  R(AMBER.base, cx + 3, shelf - 5, 3, 3);
  R(AMBER.glow, cx + 1, shelf - 13, 7, 7);
  R(AMBER.base, cx + 2, shelf - 6, 5, 1);
  R(AMBER.base, cx - 1, shelf - 12, 2, 1);
  R(AMBER.base, cx - 1, shelf - 11, 1, 3);
  R(AMBER.base, cx + 8, shelf - 12, 2, 1);
  R(AMBER.base, cx + 9, shelf - 11, 1, 3);
  R(AMBER.hot, cx + 2, shelf - 12, 1, 4);
  // A glint that slides across the bowl now and then.
  const glint = Math.floor(stage.now * 2) % 14;
  if (glint < 5) R(AMBER.white, cx + 2 + glint, shelf - 13, 1, 1);
  // The medal on its hook: a ribbon and a gold disc with a star.
  const mx = x + w - 8;
  R(STEEL.light, mx - 1, y, 3, 1);
  R(CYAN.base, mx - 2, y + 1, 2, 4);
  R(MINT, mx + 1, y + 1, 2, 4);
  disc(painter, AMBER.rim, mx, y + 8, 3);
  disc(painter, AMBER.glow, mx, y + 8, 2);
  R(AMBER.hot, mx, y + 8, 1, 1);
  R(AMBER.white, mx - 1, y + 7, 1, 1);
}

/* ------------------------------------------------------------------ rec room */

const PINK = ROOMS.rec.accent;
const TRACK: Orbit = { radius: 16, squash: 0.5, tilt: 0 };

/** The big screen over the couch: a race while anyone is on the couch, a demo lap otherwise, the alert in an alarm, off at night. */
function paintTelly(painter: Painter, stage: StageView): void {
  const { R, T } = pen(painter);
  const { x, y, w, h } = TELLY;
  const sx = x + 2;
  const sy = y + 2;
  const sw = w - 4;
  const sh = h - 9;
  // The wall bracket, then the set.
  R(STEEL.dark, x + w / 2 - 4, y + h - 5, 8, 5);
  R(INK, x, y, w, h - 5);
  R(HULL.trim, x + 1, y + h - 7, w - 2, 1);
  const playing = spotBusy(stage, 'couch');
  if (isAlarm(stage)) {
    R(ALARM.deep, sx, sy, sw, sh);
    painter.withAlpha(0.3 + 0.4 * wave(stage.now, 1.4), () => R(ALARM.dark, sx, sy, sw, sh));
    T(ALERT_TEXT, sx + sw / 2, sy + sh / 2 + 4, ALARM.white, 'centre');
    return;
  }
  if (!playing && nightFactor(stage.hour) >= 1) {
    R(UNLIT, sx, sy, sw, sh);
    R(wave(stage.now, 2.4) > 0.5 ? AMBER.glow : AMBER.ember, sx + sw - 3, sy + sh - 3, 1, 1);
    return;
  }
  R(UNLIT, sx, sy, sw, sh);
  painter.withAlpha(playing ? 1 : 0.55, () => paintRace(painter, stage.now, sx, sy, sw, sh, playing));
}

/** Two cars round an oval, pink against cyan, swapping the lead. */
function paintRace(
  painter: Painter,
  now: number,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  playing: boolean,
): void {
  const { R } = pen(painter);
  const cx = sx + sw / 2;
  const cy = sy + sh / 2 + 1;
  R(HULL.base, sx, sy, sw, 3);
  for (let a = 0; a < TAU; a += TAU / 28) {
    const p = orbitPoint(TRACK, a);
    dot(painter, STEEL.base, cx + p.x, cy + p.y);
  }
  R(PAPER, cx, cy + TRACK.radius * TRACK.squash - 1, 1, 3);
  const pace = playing ? 1.6 : 0.8;
  const pink = now * pace;
  const cyan = now * pace + 0.6 * Math.sin(now * 0.4);
  for (const [angle, colour] of [
    [pink, PINK],
    [cyan, CYAN.bright],
  ] as const) {
    const p = orbitPoint(TRACK, angle);
    R(colour, cx + p.x - 1, cy + p.y - 1, 3, 2);
  }
  // Each player's laps along the top: a pip a lap, up to five, then the race starts over.
  const laps = (angle: number): number => Math.floor(angle / TAU) % 6;
  for (let i = 0; i < laps(pink); i++) R(PINK, sx + 2 + i * 3, sy + 1, 2, 1);
  for (let i = 0; i < laps(cyan); i++) R(CYAN.bright, sx + sw - 4 - i * 3, sy + 1, 2, 1);
}

/** The punching bag on its chain. It swings while someone is at its break spot, and hangs still otherwise. */
export function paintPunchingBag(painter: Painter, stage: StageView): void {
  const { R } = pen(painter);
  const pivotX = PUNCHING_BAG.x + 8;
  const pivotY = PUNCHING_BAG.y;
  const busy = spotBusy(stage, 'bag');
  const swing = busy ? Math.sin((stage.now / 0.9) * TAU) : 0;
  const bagTop = pivotY + 45;
  const bagH = BACK_WALL_FOOT - 4 - bagTop;
  const dx = Math.round(swing * 2);
  R(STEEL.base, pivotX - 2, pivotY, 5, 2);
  for (let cy = pivotY + 2; cy < bagTop; cy += 2) {
    const t = (cy - pivotY) / (bagTop - pivotY);
    R(cy % 4 === 0 ? STEEL.light : STEEL.dark, pivotX + Math.round(dx * t), cy, 1, 2);
  }
  const bx = pivotX + dx - 4;
  R(STEEL.base, bx + 2, bagTop, 4, 2);
  R(INK, bx + 1, bagTop + 2, 6, 1);
  R(INK, bx, bagTop + 3, 8, bagH - 4);
  R(INK, bx + 1, bagTop + bagH - 1, 6, 1);
  R(STEEL.dark, bx + 1, bagTop + 3, 6, bagH - 5);
  R(STEEL.base, bx + 2, bagTop + 3, 1, bagH - 5);
  R(PINK, bx + 1, bagTop + 6, 6, 2);
  R(PINK, bx + 1, bagTop + bagH - 7, 6, 2);
  // A hit lands as the bag swings back towards the hero: two pixels of impact.
  if (busy && swing < -0.85) {
    R(PAPER, bx - 2, bagTop + 12, 1, 1);
    R(PAPER, bx - 3, bagTop + 15, 1, 1);
  }
}

/* -------------------------------------------------------------- alarm beacons */

/** Beacons under the ceiling of the rooms without JARVIS's own red (the command deck has the readout and the orb). */
export const UPPER_BEACONS: readonly number[] = [128, 258, 538];

/**
 * One beacon, hung at `x` under the ceiling line `ceil`. All hands: its lens turns red and throws a
 * short beam that sweeps side to side, at most 11 px either way. Dark otherwise.
 */
export const domeBeacon =
  (x: number, ceil: number): DecorFn =>
  (painter, stage) => {
    const { R } = pen(painter);
    const alarm = isAlarm(stage);
    // A bracket under the ceiling and a round dome on it.
    R(STEEL.dark, x - 3, ceil + 1, 7, 1);
    disc(painter, STEEL.dark, x, ceil + 4, 2);
    disc(painter, alarm ? (wave(stage.now, 0.6) > 0.5 ? ALARM.light : ALARM.base) : UNLIT, x, ceil + 4, 1);
    if (!alarm) return;
    R(ALARM.white, x, ceil + 3, 1, 1);
    const sweep = Math.sin((stage.now / 1.2) * TAU);
    const reach = Math.round(Math.abs(sweep) * 8);
    if (reach > 0) painter.withAlpha(0.35, () => R(ALARM.base, sweep > 0 ? x + 3 : x - 2 - reach, ceil + 3, reach, 3));
  };

const UPPER_CEIL = BANDS[DECK.upper].ceil;
const beacons: readonly DecorFn[] = UPPER_BEACONS.map((x) => domeBeacon(x, UPPER_CEIL));

/* ------------------------------------------------------------------- export */

/** The rec room couch: its back is set dressing; its front sorts by base line, so sitters sit behind it. */
export const paintCouchBack: DecorFn = (painter) => {
  painter.rect(COUCH_COLOURS.back, COUCH.x, COUCH.base - 22, COUCH.w, 16);
  painter.rect(ROOMS.rec.accent, COUCH.x, COUCH.base - 22, COUCH.w, 1);
};

const paintCouchFront: DecorFn = (painter) => {
  painter.rect(COUCH_COLOURS.seat, COUCH.x, COUCH.base - 8, COUCH.w, 8);
  painter.rect(COUCH_COLOURS.top, COUCH.x, COUCH.base - 8, COUCH.w, 2);
  painter.rect(COUCH_COLOURS.foot, COUCH.x, COUCH.base - 1, COUCH.w, 1);
};

/** Depth-sorted with the places and characters by base line: sitters sit behind the couch front. */
export const COUCH_PROP: Prop = { baseY: COUCH.base, draw: paintCouchFront };

/** Painted in the back layer, after the structure, in this order. */
export const UPPER_DECK_BACK: readonly DecorFn[] = [
  paintCouchBack,
  paintSuitUpTube,
  paintMissionBoard,
  paintLockers,
  paintStrongroom,
  paintBrewStation,
  paintTrophyShelf,
  paintTelly,
  paintPunchingBag,
  ...beacons,
];

/* ------------------------------------------------------------------ hotspots */

export const suitUpTip = (stage: StageView): Tip => {
  const pods = podCount(stage.vms);
  return {
    title: 'Suit-up tube',
    detail:
      'Where the rookies step out. Each rookie is a single-use CI pod on the runner VM: it suits up for one job, runs it, then is gone. The tube glows while any pod runs.',
    status: ciDown(stage)
      ? 'CI runner is down'
      : pods > 0
        ? `${plural(pods, 'rookie')} suited up`
        : 'Empty: no CI jobs',
    severity: ciDown(stage) ? 'crit' : 'ok',
  };
};

export const missionBoardTip = (stage: StageView): Tip => {
  const pods = podCount(stage.vms);
  return {
    title: 'Mission board',
    detail:
      'The CI queue: one row per rookie, three at most, as the autoscaler allows. A bar fills while that pod runs its job.',
    status: ciDown(stage) ? 'CI runner is down' : `${pods} of ${ROOKIE_ROWS} missions running`,
    severity: ciDown(stage) ? 'crit' : 'ok',
  };
};

const LOCKER_DETAIL =
  "Hulk's locker in the archive vault, on sls-data. A drawer opens and glows while Hulk answers a query.";

export const postgresLockerTip = (stage: StageView): Tip => ({
  ...postgresTip(stage),
  detail: `${LOCKER_DETAIL} One database and role per Site instance.`,
});

export const mysqlLockerTip = (stage: StageView): Tip => ({
  ...mysqlTip(stage),
  detail: `${LOCKER_DETAIL} WordPress sites file their posts here.`,
});

export const strongroomTip = ({ vaultOpen }: StageView): Tip => ({
  title: 'Strongroom',
  detail:
    'Where Hulk seals the nightly backup before the 02:30 jet run: age-encrypted database dumps and volume tars, flown to the R2 bunker off site.',
  status: vaultOpen ? 'Open: the backup is in the air' : 'Sealed',
  severity: 'ok',
});

const decor = (title: string, detail: string, status: string): Tip => ({ title, detail, status, severity: 'ok' });

export const brewTip = (stage: StageView): Tip =>
  decor(
    'Brew station',
    'Flat whites for the founders and for any hero on a break (a Site instance under 10% CPU).',
    spotBusy(stage, 'brew') ? 'Brewing' : 'Kettle is on',
  );

export const trophyTip = (): Tip =>
  decor('SMP Buildcrete', 'Our first client. The cup stays on the shelf forever.', 'Hosted off-site on DigitalOcean');

export const tellyTip = (stage: StageView): Tip => {
  const detail =
    'The big screen over the couch: LAN nights for Paul and Dhruv, and a round for any hero on a break. It carries the alert when something is down or critical.';
  if (isAlarm(stage)) return { title: 'The big screen', detail, status: 'Showing the alert', severity: 'crit' };
  const playing = spotBusy(stage, 'couch');
  const status = playing ? 'A race is on' : nightFactor(stage.hour) >= 1 ? 'Off for the night' : 'Demo lap';
  return decor('The big screen', detail, status);
};

export const bagTip = (stage: StageView): Tip =>
  decor(
    'Punching bag',
    'For a hero blowing off steam on a break (a Site instance under 10% CPU). It swings while someone is at it.',
    spotBusy(stage, 'bag') ? 'In use' : 'Free',
  );

export const UPPER_DECK_HOTSPOTS: readonly Hotspot[] = [
  { rect: SUIT_UP_TUBE, tip: suitUpTip },
  { rect: MISSION_BOARD, tip: missionBoardTip },
  { rect: POSTGRES_LOCKER, tip: postgresLockerTip },
  { rect: MYSQL_LOCKER, tip: mysqlLockerTip },
  { rect: STRONGROOM, tip: strongroomTip },
  { rect: BREW_STATION, tip: brewTip },
  { rect: TROPHY_SHELF, tip: trophyTip },
  { rect: TELLY, tip: tellyTip },
  { rect: PUNCHING_BAG, tip: bagTip },
];
