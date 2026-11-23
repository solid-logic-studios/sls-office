import type { SiteInstanceWorkload } from '../../contract/snapshot.ts';
import type { Occupant, Place, PlaceArt } from '../../contract/theme.ts';
import { ENV_PLATE } from '../office/palette.ts';
import { clientStyle } from '../office/looks.ts';
import { clamp, pen, type Pen } from '../shared/pen.ts';
import { wave } from './kit.ts';
import { vmOf } from './lab.ts';
import { ALARM, AMBER, CYAN, HULL, INK, LAMP, ROOMS, STEEL, UNLIT } from './palette.ts';

/**
 * The HQ's furniture: the consoles and posts the cast call home. Graphite consoles with a steel lip,
 * a holo screen and the room's accent, drawn from rectangles and animated from `stage.now` alone.
 *
 * Every piece paints only inside its Place's box (`x` to `x + w`, `baseY - h` to `baseY`), in every mood.
 * Rows below are measured up from the base line `b`.
 */

/* ------------------------------------------------------------------- shared */

/** Alert cards (or record cartridges) grow with memory: none under 55%, one more for every 8 points, five at most. */
export const alertCards = (mem: number): number => clamp(Math.floor((mem - 55) / 8), 0, 5);

function siteWorkload(occupant: Occupant | null): SiteInstanceWorkload | null {
  const subject = occupant?.subject;
  return subject?.kind === 'workload' && subject.workload.kind === 'site-instance' ? subject.workload : null;
}

/** A console: a graphite body on the deck, a steel lip along its top (`accent` replaces the lip's shine) and a shadow. */
function consoleBody({ R }: Pen, x: number, b: number, w: number, accent: string): void {
  R(HULL.trim, x, b - 10, w, 10);
  R(HULL.light, x + 1, b - 9, w - 2, 7);
  R(INK, x, b - 1, w, 1);
  R(STEEL.base, x, b - 11, w, 2);
  R(accent, x, b - 11, w, 1);
}

/** The holo screen's frame and glass, 9 by 7, with its left edge at `x`. Returns the glass's left edge and top. */
function screen({ R }: Pen, x: number, b: number, glass: string, w = 9): readonly [number, number] {
  R(INK, x, b - 20, w + 2, 9);
  R(glass, x + 1, b - 19, w, 7);
  return [x + 1, b - 19];
}

/** Three lines of readout scrolling up the glass. `rate` is lines a second. */
function scrollingLines({ R }: Pen, [gx, gy]: readonly [number, number], now: number, rate: number, w = 9): void {
  const step = Math.floor(now * rate);
  for (let i = 0; i < 3; i++) {
    const length = 2 + (((step + i) * 5 + gx) % (w - 3));
    R(i === 2 ? CYAN.hot : CYAN.bright, gx + 1, gy + 1 + i * 2, length, 1);
  }
}

/** A slow amber dot: the screen on standby. */
function standby({ R }: Pen, [gx, gy]: readonly [number, number], now: number): void {
  R(wave(now, 2.4, gx) > 0.5 ? AMBER.glow : AMBER.ember, gx + 7, gy + 5, 1, 1);
}

/* ------------------------------------------------------------ watch station */

type ScreenMode = 'off' | 'standby' | 'working' | 'frantic' | 'warning';

/** What a hero's screen shows: dark with nobody there, standby while away, otherwise by mood. */
function screenMode(occupant: Occupant | null): ScreenMode {
  if (occupant === null || occupant.mood === 'absent') return 'off';
  if (!occupant.atSeat || occupant.mood === 'break' || occupant.mood === 'fainted') return 'standby';
  if (occupant.mood === 'stressed') return 'warning';
  return occupant.mood === 'swamped' ? 'frantic' : 'working';
}

function paintStationScreen(pn: Pen, x: number, b: number, mode: ScreenMode, now: number): void {
  const glassColour = mode === 'warning' ? AMBER.base : mode === 'working' || mode === 'frantic' ? CYAN.deep : UNLIT;
  const glass = screen(pn, x + 1, b, glassColour);
  const [gx, gy] = glass;
  if (mode === 'working') scrollingLines(pn, glass, now + x, 2.5);
  if (mode === 'frantic') scrollingLines(pn, glass, now + x, 9);
  if (mode === 'standby') standby(pn, glass, now);
  // The warning mark blinks: a small thing, so a hard blink is allowed.
  if (mode === 'warning' && Math.floor(now * 2) % 2 === 0) {
    pn.R(INK, gx + 3, gy + 1, 2, 3);
    pn.R(INK, gx + 3, gy + 5, 2, 1);
  }
}

/** The environment's name plate with the site's first three letters, or a blank plate at an empty station. */
function paintNamePlate({ R, T }: Pen, x: number, b: number, workload: SiteInstanceWorkload | null): void {
  const plate = workload ? ENV_PLATE[workload.env] : { frame: STEEL.dark, face: HULL.base };
  R(plate.frame, x + 1, b - 10, 22, 9);
  R(plate.face, x + 2, b - 9, 20, 7);
  if (workload) T(workload.site.slice(0, 3).toUpperCase(), x + 12, b - 2, INK, 'centre');
}

/** Off duty: a hazard note over the screen. `DOWN` for an unhealthy hero, else `AWAY`. */
function paintHazardNote({ R, T }: Pen, x: number, b: number, w: number, text: string): void {
  for (let i = 0; i < w; i += 3) R(i % 6 === 0 ? LAMP.warn : INK, x + i, b - 21, Math.min(3, w - i), 2);
  R(LAMP.warn, x, b - 19, w, 8);
  T(text, x + w / 2, b - 12, INK, 'centre');
}

/** Out cold: the screen pops up into a red panel reading `OOM`. */
function paintOomPanel({ R, T }: Pen, x: number, b: number): void {
  R(ALARM.dark, x + 1, b - 21, 22, 10);
  R(ALARM.deep, x + 2, b - 20, 20, 8);
  T('OOM', x + 12, b - 12, ALARM.light, 'centre');
}

/** A hero's watch station: the screen shows the mood, the cards the memory, the plate the environment. */
export const watchStationArt: PlaceArt = (painter, { place, occupant, stage }) => {
  const pn = pen(painter);
  const { x, baseY: b, w } = place;
  const workload = siteWorkload(occupant);
  const hero = workload ? occupant : null;
  consoleBody(pn, x, b, w, workload ? clientStyle(workload.client).colour : STEEL.shine);
  paintStationScreen(pn, x, b, screenMode(hero), stage.now);
  if (hero && workload && hero.mood !== 'absent') {
    for (let i = 0; i < alertCards(workload.mem); i++) {
      pn.R(LAMP.warn, x + 17, b - 13 - i * 2, 6, 1);
      pn.R(AMBER.rim, x + 17, b - 12 - i * 2, 6, 1);
    }
  }
  paintNamePlate(pn, x, b, workload);
  if (hero?.mood === 'fainted') paintOomPanel(pn, x, b);
  if (hero?.mood === 'absent') paintHazardNote(pn, x, b, w, workload?.health === 'unhealthy' ? 'DOWN' : 'AWAY');
};

/* ------------------------------------------------------------ other consoles */

/** Nick Fury's dispatch desk: a routing screen and a patch panel of lamps that chase while the ops floor is up. */
export const dispatchDeskArt: PlaceArt = (painter, { place, stage }) => {
  const pn = pen(painter);
  const { R } = pn;
  const { x, baseY: b, w } = place;
  const { now } = stage;
  const up = vmOf(stage, 'compute')?.up ?? false;
  consoleBody(pn, x, b, w, ROOMS.ops.accent);
  const glass = screen(pn, x + 1, b, up ? CYAN.deep : UNLIT);
  if (up) scrollingLines(pn, glass, now, 4);
  // The patch panel: two rows of jacks along the front, lit in a chase as calls are patched through.
  const beat = Math.floor(now * 5);
  for (let i = 0; i < 6; i++) {
    const jx = x + 3 + i * 4;
    R(up && (beat + i) % 6 < 2 ? CYAN.bright : UNLIT, jx, b - 8, 2, 2);
    R(up && (beat * 2 + i * 5) % 7 < 3 ? LAMP.ok : UNLIT, jx, b - 5, 2, 2);
  }
  // The red line: flashes while a critical finding is open.
  const ringing = stage.findings.crit > 0 && Math.floor(now * 4) % 2 === 0;
  R(STEEL.dark, x + w - 5, b - 15, 4, 4);
  R(ringing ? ALARM.base : UNLIT, x + w - 4, b - 14, 2, 2);
};

/** Hulk's archive desk: records scroll in violet, flash cyan while a locker is open, and a rack of cartridges fills with memory. */
export const archiveDeskArt: PlaceArt = (painter, { place, stage }) => {
  const pn = pen(painter);
  const { R } = pn;
  const { x, baseY: b, w } = place;
  const data = vmOf(stage, 'data');
  const up = data?.up ?? false;
  const accent = ROOMS.archive.accent;
  consoleBody(pn, x, b, w, accent);
  const [gx, gy] = screen(pn, x + 1, b, up ? ROOMS.archive.shade : UNLIT);
  if (up) {
    const querying = stage.openStores.size > 0;
    const step = Math.floor(stage.now * (querying ? 8 : 2));
    for (let i = 0; i < 3; i++) R(querying ? CYAN.bright : accent, gx + 1, gy + 1 + i * 2, 3 + ((step + i * 3) % 5), 1);
  }
  // The cartridge rack.
  R(STEEL.dark, x + 15, b - 13, 8, 2);
  const cartridges = up && data ? clamp(alertCards(data.mem), 1, 4) : 0;
  for (let i = 0; i < cartridges; i++) R(i % 2 ? AMBER.glow : accent, x + 16 + i * 2, b - 17, 1, 4);
  // Drawer pulls on the front.
  for (const dx of [4, 16]) R(STEEL.shine, x + dx, b - 6, 4, 1);
};

/** A founder's console: gold trim, a load graph, a photo of the kids, and the founder's name in gold. */
export const founderConsoleArt: PlaceArt = (painter, { place, occupant, stage }) => {
  const pn = pen(painter);
  const { R, T } = pn;
  const { x, baseY: b, w } = place;
  const { now, host } = stage;
  consoleBody(pn, x, b, w, AMBER.glow);
  const [gx, gy] = screen(pn, x + 1, b, host ? CYAN.deep : UNLIT, 12);
  if (host) {
    for (let col = 0; col < 12; col++) {
      const height = 1 + Math.floor(4 * wave(now + col * 0.35, 3.1));
      R(col === 11 ? CYAN.hot : CYAN.bright, gx + col, gy + 6 - height, 1, height);
    }
  }
  // The photo on the console.
  R(AMBER.glow, x + 21, b - 18, 7, 7);
  R(CYAN.hot, x + 22, b - 17, 5, 5);
  for (const [dx, body] of [
    [1, CYAN.base],
    [3, LAMP.ok],
  ] as const) {
    R(AMBER.hot, x + 21 + dx, b - 15, 1, 1);
    R(body, x + 21 + dx, b - 14, 1, 2);
  }
  R(AMBER.rim, x, b - 10, w, 1);
  const name = occupant?.subject.kind === 'founder' ? occupant.subject.founder.name.toUpperCase() : '';
  if (name && painter.textWidth(name) <= w) T(name, x + w / 2, b - 2, AMBER.glow, 'centre');
};

/** A rookie's bench: a test run filling its progress bar and a result lamp, both dark until a rookie sits down. */
export const rookieBenchArt: PlaceArt = (painter, { place, occupant, stage }) => {
  const pn = pen(painter);
  const { R } = pn;
  const { x, baseY: b } = place;
  const running = occupant !== null && occupant.atSeat && occupant.mood !== 'absent';
  consoleBody(pn, x, b, place.w, ROOMS.rookieBay.accent);
  const [gx, gy] = screen(pn, x + 1, b, running ? CYAN.deep : UNLIT);
  const progress = Math.floor((stage.now * 3 + x) % 8);
  if (running) {
    R(ROOMS.rookieBay.accent, gx + 1, gy + 1, 7, 1);
    R(LAMP.ok, gx + 1, gy + 4, progress, 2);
  }
  // The result lamp on its stalk: amber while the suite runs, green as it passes.
  R(STEEL.dark, x + 19, b - 16, 2, 5);
  R(running ? (progress < 6 ? LAMP.warn : LAMP.ok) : UNLIT, x + 18, b - 19, 4, 3);
};

/* -------------------------------------------------------------------- posts */

/** A post's floor pad: a plate on the deck, its lamp lit while the occupant stands at it. */
function pad({ R }: Pen, x: number, b: number, w: number, lit: boolean, accent: string): void {
  R(STEEL.dark, x + 1, b - 2, w - 2, 2);
  R(lit ? accent : STEEL.base, x + 1, b - 2, w - 2, 1);
}

const standing = (occupant: Occupant | null): boolean => occupant !== null && occupant.atSeat;

/** A post with a plate in `accent`: the gate's Hawkeyes and Captain America in the rookie bay. */
export const padArt =
  (accent: string): PlaceArt =>
  (painter, { place, occupant }) =>
    pad(pen(painter), place.x, place.baseY, place.w, standing(occupant), accent);

/** A hero's crimson, not the alarm's bright red (section 14.5). */
const HOURGLASS = '#b8242c';

/** Black Widow's post: a plate with her red hourglass, three pixels by three. */
export const medicPostArt: PlaceArt = (painter, { place, occupant }) => {
  const pn = pen(painter);
  const { x, baseY: b, w } = place;
  pad(pn, x, b, w, standing(occupant), LAMP.ok);
  const mid = x + Math.floor(w / 2);
  pn.R(INK, mid - 3, b - 6, 5, 5);
  pn.R(HOURGLASS, mid - 2, b - 5, 3, 1);
  pn.R(HOURGLASS, mid - 1, b - 4, 1, 1);
  pn.R(HOURGLASS, mid - 2, b - 3, 3, 1);
};

/** Thor's post in the hangar: a hazard-striped marshalling pad and a signal lamp that flashes while Thor is out. */
export const hangarPostArt: PlaceArt = (painter, { place, occupant, stage }) => {
  const { R } = pen(painter);
  const { x, baseY: b, w } = place;
  for (let i = 0; i < w; i += 2) R(i % 4 === 0 ? ROOMS.hangar.accent : INK, x + i, b - 2, Math.min(2, w - i), 2);
  R(STEEL.dark, x + w - 2, b - 18, 2, 16);
  R(INK, x + w - 3, b - 22, 3, 4);
  R(signalLamp(occupant, stage.now), x + w - 2, b - 21, 1, 2);
};

/** Dark with nobody on duty, green while Thor is at the post, flashing amber while Thor is out. */
function signalLamp(occupant: Occupant | null, now: number): string {
  if (occupant === null || occupant.mood === 'absent') return UNLIT;
  if (occupant.atSeat) return LAMP.ok;
  return Math.floor(now * 3) % 2 === 0 ? LAMP.warn : AMBER.rim;
}

/** The JARVIS remote's dock: two arms over a plate, a charge field between them while the remote is home. */
export const dockArt: PlaceArt = (painter, { place, occupant, stage }) => {
  const { R } = pen(painter);
  const { x, baseY: b, w } = place;
  const { now } = stage;
  const home = standing(occupant);
  if (home) painter.withAlpha(0.12 + 0.12 * wave(now, 2.2), () => R(AMBER.glow, x + 2, b - 13, w - 4, 11));
  R(STEEL.dark, x, b - 2, w, 2);
  R(STEEL.base, x, b - 2, w, 1);
  for (const ax of [x, x + w - 2]) {
    R(STEEL.base, ax, b - 13, 2, 11);
    R(STEEL.shine, ax, b - 13, 1, 11);
  }
  // The arm tips: steady while charging, a slow beacon while the remote is out on the floor.
  const tip = home || wave(now, 2.6) > 0.5 ? AMBER.glow : AMBER.ember;
  R(tip, x, b - 15, 2, 2);
  R(tip, x + w - 2, b - 15, 2, 2);
  R(home ? AMBER.hot : UNLIT, x + Math.floor(w / 2) - 1, b - 1, 2, 1);
};

/* --------------------------------------------------------------- placements */

/** A seated Place's base line is 6 px behind the walk line, and its sitter 9 px behind. */
const SEAT_BACK = 6;
const SITTER_BACK = 9;
/** Every console is this tall, from the deck to the top of its screen. */
const CONSOLE_HEIGHT = 21;

/** A console on the deck whose walk line is `walk`, with its sitter `seat` px from its left edge. */
export function consolePlace(art: PlaceArt, x: number, w: number, seat: number, floor: number, walk: number): Place {
  return {
    x,
    w,
    h: CONSOLE_HEIGHT,
    baseY: walk - SEAT_BACK,
    floor,
    seat: { x: x + seat, y: walk - SITTER_BACK },
    art,
  };
}

/** Somewhere to stand on the walk line, `w` wide and centred on `x`; `h` is about the occupant's height. */
export function postPlace(art: PlaceArt, x: number, floor: number, walk: number, w = 10, h = 22): Place {
  return { x: x - w / 2, w, h, baseY: walk, floor, seat: { x }, art };
}
