import type { Painter } from '../../contract/painter.ts';
import type { DecorFn, Rect, StageView } from '../../contract/theme.ts';
import { nightFactor, openToSky } from '../shared/sky.ts';
import { SPINE } from './boards.ts';
import {
  APRON,
  BANDS,
  BAYS,
  DECK,
  GROUND_Y,
  HEIGHT,
  HULL_RECT,
  SHAFT,
  SUBLEVEL,
  WIDTH,
  type DeckBand,
  type Span,
} from './geometry.ts';
import { jarvisState } from './jarvis-state.ts';
import { wave } from './kit.ts';
import { ALARM, AMBER, CYAN, HULL, INK, ROOMS, STEEL, type RoomColours } from './palette.ts';

/**
 * The HQ's structure: the headland it stands on, the hull, the two decks' rooms, the lift shaft and
 * the openings in its walls. Room dressing (boards, lockers, the jet) is painted over this.
 */

/** The rooftop sign: 'SOLID LOGIC STUDIOS' is 133 px in bold, and the board's face is 146 px. */
export const ROOF_SIGN = { x: 196, y: 10, w: 150, h: 20, text: 'SOLID LOGIC STUDIOS' } as const;

/** How tall a doorway is, measured up from the front of the floor. A person is 22 px tall. */
export const DOOR_HEIGHT = 32;

/** The two ways out: the gate in the left wall and the hangar door in the right, both on the ground deck. */
export const GATE: Rect = { x: 8, y: 204, w: 6, h: 40 };
export const HANGAR_DOOR: Rect = { x: 562, y: 198, w: 6, h: 46 };

/** Where a wall crosses a walk line: the partitions upstairs and the shaft's walls on both decks. */
export const DOORWAYS: readonly { x: number; deck: number }[] = [
  { x: 140, deck: DECK.upper },
  { x: 270, deck: DECK.upper },
  { x: 442, deck: DECK.upper },
  { x: 470, deck: DECK.upper },
  { x: 442, deck: DECK.ground },
  { x: 470, deck: DECK.ground },
];
const WALL = 4;

const ROCK = { top: '#3a4252', base: '#2a303d', seam: '#232833' } as const;
const TARMAC = { base: '#4a5260', edge: '#5d6675', paint: '#f2c230' } as const;
/** The lift shaft's well, its rails, the landings across it and their lit lip. */
export const SHAFT_COLOURS = { well: '#0d111b', rail: '#1d2536', landing: '#55617a', lip: '#8fa0b8' } as const;

/** The headland the HQ stands on, and the jet apron outside the hangar door. */
function paintGround(painter: Painter): void {
  painter.rect(ROCK.base, 0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  painter.rect(ROCK.top, 0, GROUND_Y, WIDTH, 2);
  for (let y = GROUND_Y + 12; y < HEIGHT; y += 14) painter.rect(ROCK.seam, 0, y, WIDTH, 1);
  const [x0, x1] = APRON;
  painter.rect(TARMAC.base, x0, GROUND_Y - 1, x1 - x0, 5);
  painter.rect(TARMAC.edge, x0, GROUND_Y - 1, x1 - x0, 1);
  for (let x = x0 + 6; x < x1 - 4; x += 12) painter.rect(TARMAC.paint, x, GROUND_Y + 1, 6, 1);
}

function paintHull(painter: Painter): void {
  const { x, y, w, h } = HULL_RECT;
  painter.rect(HULL.base, x, y, w, h);
  // Plating seams, so the bare hull between rooms is not flat.
  for (let sx = x + 40; sx < x + w; sx += 40) painter.rect(HULL.dark, sx, y, 1, h);
  // The roof: a deck with a lit edge, the sign on its legs and a mast.
  painter.rect(HULL.trim, x - 4, y - 6, w + 8, 6);
  painter.rect(STEEL.base, x - 4, y - 6, w + 8, 1);
  painter.rect(INK, ROOF_SIGN.x, ROOF_SIGN.y, ROOF_SIGN.w, ROOF_SIGN.h);
  painter.rect(HULL.light, ROOF_SIGN.x + 2, ROOF_SIGN.y + 2, ROOF_SIGN.w - 4, ROOF_SIGN.h - 4);
  for (const leg of [ROOF_SIGN.x + 18, ROOF_SIGN.x + ROOF_SIGN.w - 21]) painter.rect(INK, leg, ROOF_SIGN.y + 20, 3, 4);
  painter.text(ROOF_SIGN.text, ROOF_SIGN.x + ROOF_SIGN.w / 2, ROOF_SIGN.y + 15, AMBER.glow, {
    align: 'centre',
    bold: true,
  });
  painter.rect(STEEL.base, 520, 10, 1, 24);
  painter.rect(STEEL.base, 516, 16, 9, 1);
  // The slab under the ground deck, over the sub-level.
  painter.rect(HULL.dark, x, GROUND_Y, w, SUBLEVEL.y - GROUND_Y);
}

/** One room from `x0` to `x1` on a floor whose lines are `band`: back wall, its lower shade, the accent strip under the ceiling, the floor and its seams. */
export function paintRoom(
  painter: Painter,
  [x0, x1]: Span,
  band: Pick<DeckBand, 'ceil' | 'back' | 'front'>,
  c: RoomColours,
): void {
  const w = x1 - x0;
  painter.rect(c.wall, x0, band.ceil, w, band.back - band.ceil);
  painter.rect(c.shade, x0, band.back - 9, w, 8);
  painter.rect(INK, x0, band.back - 1, w, 1);
  painter.rect(c.accent, x0, band.ceil, w, 1);
  painter.rect(c.floor, x0, band.back, w, band.front - band.back);
  for (let x = x0 + 6; x < x1; x += 16) painter.rect(c.line, x, band.back + 1, 1, band.front - band.back - 1);
  painter.rect(c.line, x0, band.back + 8, w, 1);
}

function paintRooms(painter: Painter): void {
  const [ground, upper] = BANDS;
  paintRoom(painter, BAYS.rookieBay, upper, ROOMS.rookieBay);
  paintRoom(painter, BAYS.archive, upper, ROOMS.archive);
  paintRoom(painter, BAYS.command, upper, ROOMS.command);
  paintRoom(painter, BAYS.rec, upper, ROOMS.rec);
  paintRoom(painter, BAYS.ops, ground, ROOMS.ops);
  paintRoom(painter, BAYS.hangar, ground, ROOMS.hangar);
}

function paintLabels(painter: Painter): void {
  const at = (deck: number): number => (BANDS[deck]?.ceil ?? 0) + 12;
  const label = (text: string, [x0]: Span, deck: number, c: RoomColours): void =>
    painter.text(text, x0 + 4, at(deck), c.accent);
  label('ROOKIE BAY', BAYS.rookieBay, DECK.upper, ROOMS.rookieBay);
  label('ARCHIVE VAULT', BAYS.archive, DECK.upper, ROOMS.archive);
  label('REC ROOM', BAYS.rec, DECK.upper, ROOMS.rec);
  label('OPS FLOOR', BAYS.ops, DECK.ground, ROOMS.ops);
  label('HANGAR', BAYS.hangar, DECK.ground, ROOMS.hangar);
}

/** The shaft, a landing across it on each deck, and a doorway wherever a wall crosses a walk line. */
function paintShaft(painter: Painter): void {
  const top = BANDS[DECK.upper].ceil;
  painter.rect(SHAFT_COLOURS.well, SHAFT.x, top, SHAFT.w, GROUND_Y - top);
  for (const x of [SHAFT.x + 5, SHAFT.x + SHAFT.w - 6]) painter.rect(SHAFT_COLOURS.rail, x, top, 1, GROUND_Y - top);
  for (const band of BANDS) {
    painter.rect(SHAFT_COLOURS.landing, SHAFT.x, band.back, SHAFT.w, band.front - band.back);
    painter.rect(SHAFT_COLOURS.lip, SHAFT.x, band.back, SHAFT.w, 1);
  }
  for (const door of DOORWAYS) {
    const band = BANDS[door.deck];
    if (!band) continue;
    const doorTop = band.front - DOOR_HEIGHT;
    painter.rect(HULL.dark, door.x, doorTop, WALL, band.back - doorTop);
    painter.rect(SHAFT_COLOURS.landing, door.x, band.back, WALL, band.front - band.back);
    painter.rect(STEEL.base, door.x - 1, doorTop - 2, WALL + 2, 2);
  }
}

/** An opening in the hull that shows the live sky: a window, the gate, the hangar door. */
function paintPort(painter: Painter, stage: StageView, { x, y, w, h }: Rect, framed: boolean): void {
  openToSky(painter, stage, x, y, w, h);
  if (!framed) return;
  painter.rect(STEEL.base, x - 1, y - 1, w + 2, 1);
  painter.rect(STEEL.dark, x - 1, y + h, w + 2, 1);
  painter.rect(STEEL.dark, x - 1, y, 1, h);
  painter.rect(STEEL.dark, x + w, y, 1, h);
  painter.rect(STEEL.dark, x + (w >> 1), y, 1, h);
}

/** The command deck's two windows, either side of the orb. */
export const COMMAND_WINDOWS: readonly Rect[] = [
  { x: 286, y: 64, w: 30, h: 28 },
  { x: 400, y: 64, w: 30, h: 28 },
];

function paintOpenings(painter: Painter, stage: StageView): void {
  for (const window of COMMAND_WINDOWS) paintPort(painter, stage, window, true);
  paintPort(painter, stage, GATE, false);
  painter.rect(STEEL.base, GATE.x - 1, GATE.y - 3, GATE.w + 2, 3);
  paintPort(painter, stage, HANGAR_DOOR, false);
  painter.rect(STEEL.base, HANGAR_DOOR.x - 2, HANGAR_DOOR.y - 5, HANGAR_DOOR.w + 3, 5);
  painter.rect('#f2c230', HANGAR_DOOR.x - 2, HANGAR_DOOR.y - 2, HANGAR_DOOR.w + 3, 1);
}

const CEILING_LIGHTS: readonly (readonly [x: number, deck: number])[] = [
  [40, DECK.ground],
  [120, DECK.ground],
  [200, DECK.ground],
  [280, DECK.ground],
  [400, DECK.ground],
  [510, DECK.ground],
  [60, DECK.upper],
  [190, DECK.upper],
  [510, DECK.upper],
];

function paintCeilingLights(painter: Painter): void {
  for (const [x, deck] of CEILING_LIGHTS) painter.rect('#dfeaf6', x, (BANDS[deck]?.ceil ?? 0) + 1, 14, 2);
}

/** The spine: the conduit on the ops floor's back wall that carries the core's power up to the orb. */
export const paintSpine: DecorFn = (painter, { now, host }) => {
  const { ceil, back } = BANDS[DECK.ground];
  painter.rect(INK, SPINE.x - 1, ceil, SPINE.w + 2, back - ceil);
  painter.rect(STEEL.dark, SPINE.x, ceil, SPINE.w, back - ceil);
  for (let y = ceil + 10; y < back; y += 20) painter.rect(STEEL.base, SPINE.x - 2, y, SPINE.w + 4, 2);
  if (host === null) return;
  // Pulses climb the spine: cyan as they leave the core, amber by the time they reach the orb.
  const climb = Math.floor(now * 16) % 12;
  for (let y = back - 2 - climb; y > ceil; y -= 12) {
    painter.rect(y > (ceil + back) / 2 ? CYAN.bright : AMBER.glow, SPINE.x + 1, y, 2, 3);
  }
};

/** The static structure. It takes the stage because its openings show the live sky. */
export const paintStructure: DecorFn = (painter, stage) => {
  paintGround(painter);
  paintHull(painter);
  paintRooms(painter);
  paintShaft(painter);
  paintOpenings(painter, stage);
  paintCeilingLights(painter);
  paintLabels(painter);
};

const LIT_AREA: Rect = { x: HULL_RECT.x, y: HULL_RECT.y, w: HULL_RECT.w, h: SUBLEVEL.y + SUBLEVEL.h - HULL_RECT.y };

/** A blue wash over `area` after dark. */
export const nightTint =
  ({ x, y, w, h }: Rect): DecorFn =>
  (painter, { hour }) => {
    const night = nightFactor(hour);
    if (night <= 0) return;
    painter.withAlpha(0.16 * night, () => painter.rect('#050818', x, y, w, h));
  };

/** The night tint over the whole HQ. */
export const paintNightTint = nightTint(LIT_AREA);

/** How long one swell of the all-hands wash takes. Slow on purpose: a whole-stage light must never strobe. */
export const ALARM_WASH_SECONDS = 1.2;

/** All hands: a red wash that swells and fades over `area` while JARVIS is in alarm. */
export const alarmWash =
  ({ x, y, w, h }: Rect): DecorFn =>
  (painter, stage) => {
    if (jarvisState(stage) !== 'alarm') return;
    const alpha = 0.04 + 0.1 * wave(stage.now, ALARM_WASH_SECONDS);
    painter.withAlpha(alpha, () => painter.rect(ALARM.base, x, y, w, h));
  };

/** The all-hands wash over the whole HQ. */
export const paintAlarmWash = alarmWash(LIT_AREA);
