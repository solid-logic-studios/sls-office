import type { Painter } from '../../contract/painter.ts';
import type { DecorFn } from '../../contract/theme.ts';
import { AMBER, CYAN, HULL, INK, ROOMS, STEEL, type RoomColours } from '../hq/palette.ts';
import { SHAFT_COLOURS, alarmWash, nightTint, paintRoom } from '../hq/shell.ts';
import { JARVIS, MOTOR_ROOM, ROOF_DECK } from './boards.ts';
import {
  AXIS,
  DOOR_HEIGHT,
  FLOOR,
  HEIGHT,
  INSIDE,
  PARTITION_X,
  ROOF,
  SHAFT,
  SHAFT_WALL,
  STOREYS,
  WIDTH,
  band,
} from './geometry.ts';

/**
 * The Spire's structure in the HQ's materials: graphite hull, mid-dark rooms with an accent strip
 * under each ceiling, the lift shaft, the openings in its walls, and the spine that carries the core's
 * power up every storey to the orb on the roof.
 */

/** Walls the walk line crosses, each with a doorway: the shaft wall on every storey, and the archive's partition. */
export const DOORWAYS: readonly { x: number; w: number; floor: number }[] = [
  ...Array.from({ length: STOREYS }, (_, floor) => ({ x: SHAFT_WALL, w: SHAFT.x - SHAFT_WALL, floor })),
  { x: PARTITION_X - 2, w: 4, floor: FLOOR.hangar },
];

function paintHull(painter: Painter): void {
  painter.rect(HULL.base, 0, ROOF, WIDTH, HEIGHT - ROOF);
  for (let x = 40; x < WIDTH; x += 40) painter.rect(HULL.dark, x, ROOF, 1, HEIGHT - ROOF);
  // The slab over each storey, lit along its underside.
  for (let floor = 0; floor < STOREYS; floor++) {
    const { top, ceil } = band(floor);
    painter.rect(HULL.dark, 0, top, WIDTH, ceil - top);
    painter.rect(HULL.light, INSIDE.left, ceil - 1, INSIDE.right - INSIDE.left, 1);
  }
  // Under the street the hull is dug into rock: the sub-level is darker plating.
  const street = band(FLOOR.gate).front;
  painter.rect(HULL.dark, 0, street, WIDTH, HEIGHT - street);
  painter.rect(STEEL.dark, 0, street, WIDTH, 2);
}

/** The roof deck with a lit edge, and the lift's motor room at its right. */
function paintRoof(painter: Painter): void {
  painter.rect(HULL.trim, 0, ROOF_DECK, WIDTH, ROOF - ROOF_DECK);
  painter.rect(STEEL.base, 0, ROOF_DECK, WIDTH, 1);
  const { x, y, w, h } = MOTOR_ROOM;
  painter.rect(INK, x - 1, y, w + 2, h);
  painter.rect(HULL.trim, x, y + 1, w, h - 1);
  painter.rect(STEEL.base, x - 1, y, w + 2, 1);
  for (let vy = y + 4; vy < y + h - 2; vy += 3) painter.rect(HULL.dark, x + 3, vy, w - 6, 1);
}

function paintRooms(painter: Painter): void {
  const wide = [INSIDE.left, SHAFT_WALL] as const;
  paintRoom(painter, wide, band(FLOOR.command), ROOMS.command);
  paintRoom(painter, wide, band(FLOOR.rookieBay), ROOMS.rookieBay);
  paintRoom(painter, [INSIDE.left, PARTITION_X], band(FLOOR.hangar), ROOMS.archive);
  paintRoom(painter, [PARTITION_X, SHAFT_WALL], band(FLOOR.hangar), ROOMS.hangar);
  for (const floor of [FLOOR.ops2, FLOOR.ops1, FLOOR.gate]) paintRoom(painter, wide, band(floor), ROOMS.ops);
  paintRoom(painter, wide, band(FLOOR.sublevel), ROOMS.sublevel);
}

/** The shaft, a landing in it on every storey, and a doorway wherever a wall crosses a walk line. */
function paintShaft(painter: Painter): void {
  const top = band(FLOOR.command).ceil;
  const bottom = band(FLOOR.sublevel).front;
  painter.rect(SHAFT_COLOURS.well, SHAFT.x, top, SHAFT.w, bottom - top);
  for (const x of [SHAFT.x + 3, SHAFT.x + SHAFT.w - 4]) painter.rect(SHAFT_COLOURS.rail, x, top, 1, bottom - top);
  for (let floor = 0; floor < STOREYS; floor++) {
    const b = band(floor);
    painter.rect(SHAFT_COLOURS.landing, SHAFT.x, b.back, SHAFT.w, b.front - b.back);
    painter.rect(SHAFT_COLOURS.lip, SHAFT.x, b.back, SHAFT.w, 1);
  }
  for (const door of DOORWAYS) {
    const b = band(door.floor);
    const doorTop = b.front - DOOR_HEIGHT;
    painter.rect(HULL.dark, door.x, b.ceil, door.w, doorTop - b.ceil);
    painter.rect(STEEL.base, door.x - 1, doorTop - 2, door.w + 2, 2);
  }
}

function paintLabels(painter: Painter): void {
  const label = (text: string, x: number, floor: number, c: RoomColours): void =>
    painter.text(text, x, band(floor).ceil + 8, c.accent);
  label('ROOKIE BAY', INSIDE.left + 4, FLOOR.rookieBay, ROOMS.rookieBay);
  label('HANGAR', PARTITION_X + 4, FLOOR.hangar, ROOMS.hangar);
  label('OPS FLOOR', INSIDE.left + 4, FLOOR.ops2, ROOMS.ops);
}

/** Two strip lights under each ceiling the readout and the core leave clear. */
const CEILING_LIGHTS: readonly (readonly [x: number, floor: number])[] = [
  [70, FLOOR.rookieBay],
  [40, FLOOR.hangar],
  [150, FLOOR.hangar],
  [80, FLOOR.ops2],
  [130, FLOOR.ops2],
  [40, FLOOR.ops1],
  [100, FLOOR.ops1],
  [120, FLOOR.gate],
];

function paintCeilingLights(painter: Painter): void {
  for (const [x, floor] of CEILING_LIGHTS) painter.rect(STEEL.shine, x, band(floor).ceil + 1, 14, 2);
}

/** The static structure: hull, roof, rooms, shaft and doorways, lights and labels. */
export const paintStructure: DecorFn = (painter) => {
  paintHull(painter);
  paintRoof(painter);
  paintRooms(painter);
  paintShaft(painter);
  paintCeilingLights(painter);
  paintLabels(painter);
};

/** From the top of the core's hub chamber up to the foot of the orb's projector. */
const SPINE = {
  x: AXIS - 2,
  w: 4,
  top: JARVIS.pedestal.y + JARVIS.pedestal.h,
  bottom: band(FLOOR.sublevel).ceil,
} as const;

/**
 * The spine: the conduit up the back wall of every storey that carries the core's power to the orb.
 * Pulses climb it: cyan as they leave the core, amber by the time they reach the orb.
 */
export const paintSpine: DecorFn = (painter, { now, host }) => {
  const { x, w, top, bottom } = SPINE;
  painter.rect(INK, x - 1, top, w + 2, bottom - top);
  painter.rect(STEEL.dark, x, top, w, bottom - top);
  for (let y = top + 10; y < bottom; y += 20) painter.rect(STEEL.base, x - 2, y, w + 4, 2);
  if (host === null) return;
  const climb = Math.floor(now * 16) % 12;
  for (let y = bottom - 2 - climb; y > top; y -= 12) {
    painter.rect(y > (top + bottom) / 2 ? CYAN.bright : AMBER.glow, x + 1, y, 2, 3);
  }
};

/** Everything under the roof: the night tint and the all-hands wash cover it, and leave the orb in the open sky. */
const BUILDING = { x: 0, y: ROOF, w: WIDTH, h: HEIGHT - ROOF } as const;

/** The HQ's blue wash over the building after dark. */
export const paintNightTint = nightTint(BUILDING);

/** All hands: the HQ's red wash, swelling and fading over the whole Spire while JARVIS is in alarm. */
export const paintAlarmWash = alarmWash(BUILDING);
