import type { Painter } from '../../contract/painter.ts';
import type { DecorFn, StageView } from '../../contract/theme.ts';
import type { Pen } from '../shared/pen.ts';
import { pen } from '../shared/pen.ts';
import { nightFactor } from '../shared/sky.ts';
import { CI_BOARD, COFFEE_COUNTER, MYSQL_CABINET, POSTGRES_CABINET, ROOF_SIGN, RUNNER_RACK } from './boards.ts';
import { DOOR_HEIGHT, FLOOR, HEIGHT, INSIDE, ROOF, SHAFT, SHELL_X, STOREYS, WIDTH, band } from './geometry.ts';
import { DESK_GAP_X, PARTITION_X } from './layout.ts';
import { openToSky, paintWindow } from './sky.ts';

/** The building: shell, roof and sign, each storey's room, and the fixed furniture on its walls. */

const SHELL = '#3b3350';
const FRAME = '#2a2533';

interface RoomColours {
  wall: string;
  shade: string;
  floor: string;
  line: string;
}

const WOOD = { floor: '#a8794f', line: '#946740' };
const TILE = { floor: '#7f8fa3', line: '#72829a' };

/** One room's back wall, skirting, floor and floorboards, from `x0` to `x1` on `floor`. */
function paintRoom({ R }: Pen, x0: number, x1: number, floor: number, c: RoomColours): void {
  const b = band(floor);
  const w = x1 - x0;
  R(c.wall, x0, b.ceil, w, b.back - b.ceil);
  R(c.shade, x0, b.back - 7, w, 6);
  R(FRAME, x0, b.back - 1, w, 1);
  R(c.floor, x0, b.back, w, b.front - b.back);
  for (let x = x0 + 6; x < x1; x += 16) R(c.line, x, b.back + 1, 1, b.front - b.back - 1);
  R(c.line, x0, b.back + 6, w, 1);
}

function paintRoof(painter: Painter): void {
  const { R, T } = pen(painter);
  // Parapet, sign on its legs, and the lift's motor room under the findings lamp.
  R('#8a4a44', 0, ROOF - 4, WIDTH, 4);
  R('#a85d52', 0, ROOF - 4, WIDTH, 1);
  R(FRAME, ROOF_SIGN.x, ROOF_SIGN.y, ROOF_SIGN.w, ROOF_SIGN.h);
  R('#4a4266', ROOF_SIGN.x + 2, ROOF_SIGN.y + 2, ROOF_SIGN.w - 4, ROOF_SIGN.h - 4);
  R(FRAME, ROOF_SIGN.x + 16, ROOF_SIGN.y + ROOF_SIGN.h, 3, ROOF - 4 - ROOF_SIGN.y - ROOF_SIGN.h);
  R(FRAME, ROOF_SIGN.x + ROOF_SIGN.w - 19, ROOF_SIGN.y + ROOF_SIGN.h, 3, ROOF - 4 - ROOF_SIGN.y - ROOF_SIGN.h);
  T(ROOF_SIGN.text, ROOF_SIGN.x + ROOF_SIGN.w / 2, ROOF_SIGN.y + 15, '#f2c230', 'centre', true);
  R('#5c6877', SHAFT.x, ROOF - 14, SHAFT.w, 10);
  R('#7d8a9a', SHAFT.x, ROOF - 14, SHAFT.w, 1);
}

function paintShell(painter: Painter): void {
  const { R } = pen(painter);
  const lobbyFront = band(FLOOR.lobby).front;
  R(SHELL, SHELL_X.left, ROOF, SHELL_X.right - SHELL_X.left, lobbyFront - ROOF);
  // The street, then earth either side of the basement.
  R('#4d8b4f', 0, lobbyFront, WIDTH, 2);
  R('#6a4b36', 0, lobbyFront + 2, WIDTH, HEIGHT - lobbyFront - 2);
  R('#262231', SHELL_X.left, lobbyFront + 2, SHELL_X.right - SHELL_X.left, HEIGHT - lobbyFront - 2);
}

function paintRooms(painter: Painter): void {
  const pn = pen(painter);
  const left = INSIDE.left;
  const right = SHAFT.x;
  paintRoom(pn, left, right, FLOOR.storey5, { wall: '#e6d6b4', shade: '#d2c09a', ...WOOD });
  paintRoom(pn, left, right, FLOOR.storey4, { wall: '#b7d3c2', shade: '#9fbfad', ...WOOD });
  paintRoom(pn, left, PARTITION_X, FLOOR.storey3, { wall: '#cdbb9c', shade: '#b7a585', ...WOOD });
  paintRoom(pn, PARTITION_X, right, FLOOR.storey3, {
    wall: '#34335f',
    shade: '#2b2a50',
    floor: '#7a5a3c',
    line: '#6a4c30',
  });
  for (const floor of [FLOOR.storey2, FLOOR.storey1, FLOOR.lobby]) {
    paintRoom(pn, left, right, floor, { wall: '#d3e0e8', shade: '#bccdd8', ...TILE });
  }
  paintRoom(pn, left, right, FLOOR.basement, { wall: '#2e2a3c', shade: '#28243a', floor: '#4a4560', line: '#423d58' });
}

/** The wall between the data and deploy rooms, with a doorway where the walk line crosses it. */
function paintPartition(painter: Painter): void {
  const { R } = pen(painter);
  const b = band(FLOOR.storey3);
  const doorTop = b.front - DOOR_HEIGHT;
  R(SHELL, PARTITION_X - 1, b.ceil, 2, doorTop - b.ceil);
  R(FRAME, PARTITION_X - 2, doorTop - 1, 4, 1);
}

/** Labels at the top left of each room. */
function paintLabels(painter: Painter): void {
  const { T } = pen(painter);
  const at = (floor: number): number => band(floor).ceil + 8;
  T('SLS HQ', INSIDE.left + 2, at(FLOOR.storey5), '#8a744a');
  T('SLS-CI', INSIDE.left + 2, at(FLOOR.storey4), '#3f6a55');
  T('SLS-DATA', 34, at(FLOOR.storey3), '#6e5a3a');
  T('DEPLOY', PARTITION_X + 3, at(FLOOR.storey3), '#9fa0d8');
  T('SLS-COMPUTE', INSIDE.left + 2, at(FLOOR.lobby), '#586878');
  T('PVE', INSIDE.left + 2, at(FLOOR.basement), '#9fe8e0', 'left', true);
}

const CEILING_LIGHTS: readonly number[] = [30, 90, 150];

/** Ceiling lights on every storey, glowing on the floor below after dark. */
function paintLights(painter: Painter, hour: number): void {
  const { R } = pen(painter);
  const night = nightFactor(hour);
  for (let floor = 0; floor < STOREYS; floor++) {
    const b = band(floor);
    for (const x of CEILING_LIGHTS) {
      R('#f6f2c8', x, b.ceil, 14, 1);
      if (night > 0) painter.withAlpha(0.22 * night, () => R('#ffe9a8', x - 6, b.ceil + 1, 26, b.front - b.ceil - 1));
    }
  }
}

/** The front door in the lobby's left wall, open to the street. */
function paintFrontDoor(painter: Painter, stage: StageView): void {
  const { R } = pen(painter);
  const b = band(FLOOR.lobby);
  openToSky(painter, stage, SHELL_X.left, b.front - DOOR_HEIGHT, INSIDE.left - SHELL_X.left, DOOR_HEIGHT);
  R('#5a4a3a', SHELL_X.left - 1, b.front - DOOR_HEIGHT - 3, INSIDE.left - SHELL_X.left + 2, 3);
  R('#a23f38', INSIDE.left, b.front - 2, 14, 2);
}

function paintWindows(painter: Painter, stage: StageView): void {
  const top = (floor: number): number => band(floor).ceil + 3;
  paintWindow(painter, stage, 84, top(FLOOR.storey5) + 2, 26, 18);
  paintWindow(painter, stage, 70, top(FLOOR.storey4), 20, 10);
  paintWindow(painter, stage, 110, top(FLOOR.storey3), 12, 12);
  for (const floor of [FLOOR.storey2, FLOOR.storey1]) {
    paintWindow(painter, stage, 30, top(floor), 20, 10);
    paintWindow(painter, stage, 116, top(floor), 20, 10);
  }
  paintWindow(painter, stage, 156, top(FLOOR.lobby), 24, 14);
}

/* ----------------------------------------------------------------- storeys */

function paintCoffeeCounter({ R }: Pen): void {
  const b = band(FLOOR.storey5);
  const { x, w } = COFFEE_COUNTER;
  R('#8a6442', x, b.desk - 14, w, 14);
  R('#c9a777', x, b.desk - 16, w, 2);
  R('#2f3340', 124, b.desk - 30, 12, 14);
  R('#4a5062', 125, b.desk - 29, 10, 4);
  R('#e0523f', 126, b.desk - 23, 2, 2);
  R('#15151f', 128, b.desk - 20, 4, 4);
  R('#ffffff', 140, b.desk - 20, 3, 4);
  R('#e9c46a', 144, b.desk - 20, 3, 4);
  // A pot plant in the corner by the lift.
  R('#a5573f', 172, b.desk - 8, 8, 8);
  R('#3f9a52', 174, b.desk - 20, 4, 12);
  R('#58b56a', 171, b.desk - 17, 3, 7);
  R('#58b56a', 178, b.desk - 16, 3, 6);
}

function paintCiBoard({ R, T }: Pen): void {
  const { x, y, w, h } = CI_BOARD;
  R('#8a8f98', x, y, w, h);
  R('#eef3f5', x + 1, y + 1, w - 2, h - 2);
  T('CI QUEUE', x + 3, y + 9, '#586878');
  R('#e0563f', x + 3, y + 12, 22, 2);
  R('#3f8fd0', x + 3, y + 15, 34, 2);
  R('#4aa86b', x + 3, y + 18, 14, 2);
}

function paintCabinet(
  { R }: Pen,
  rect: { x: number; y: number; w: number; h: number },
  body: string,
  face: string,
): void {
  const { x, y, w, h } = rect;
  R(body, x, y, w, h);
  for (let i = 0; i < 3; i++) {
    R(face, x + 1, y + 1 + i * 9, w - 2, 8);
    R('#39424d', x + w / 2 - 3, y + 5 + i * 9, 6, 1);
    R('#f4f1e6', x + w / 2 - 4, y + 2 + i * 9, 8, 2);
  }
}

function paintRunnerRack({ R }: Pen): void {
  const { x, y, w, h } = RUNNER_RACK;
  R('#1d1d2a', x, y, w, h);
  R('#2f2f44', x + 1, y + 1, w - 2, h - 2);
  for (let i = 0; i < 4; i++) R('#15151f', x + 2, y + 3 + i * 6, w - 4, 4);
}

/** The skinny water cooler between the third and fourth desks on storey 1, and a pot plant on storey 2. */
function paintDeskGap({ R }: Pen): void {
  const cooler = band(FLOOR.storey1);
  const x = DESK_GAP_X - 3;
  R('#e9eef2', x, cooler.desk - 9, 6, 9);
  R('#bfe6fa', x + 1, cooler.desk - 17, 4, 8);
  R('#3f8fd0', x + 2, cooler.desk - 6, 2, 1);
  const plant = band(FLOOR.storey2);
  R('#a5573f', x, plant.desk - 6, 6, 6);
  R('#3f9a52', x + 2, plant.desk - 18, 2, 12);
  R('#58b56a', x, plant.desk - 14, 2, 6);
  R('#58b56a', x + 4, plant.desk - 13, 2, 5);
}

export const paintBuilding: DecorFn = (painter, stage) => {
  const pn = pen(painter);
  paintRoof(painter);
  paintShell(painter);
  paintRooms(painter);
  paintPartition(painter);
  paintWindows(painter, stage);
  paintLights(painter, stage.hour);
  paintFrontDoor(painter, stage);
  paintLabels(painter);
  paintCoffeeCounter(pn);
  paintCiBoard(pn);
  paintCabinet(pn, POSTGRES_CABINET, '#476a94', '#6f93bf');
  paintCabinet(pn, MYSQL_CABINET, '#a8703a', '#d19a5c');
  paintRunnerRack(pn);
  paintDeskGap(pn);
};

/** A blue wash over the building after dark. */
export const paintNightTint: DecorFn = (painter, { hour }) => {
  const night = nightFactor(hour);
  if (night <= 0) return;
  painter.withAlpha(0.16 * night, () =>
    painter.rect('#080a28', SHELL_X.left, ROOF, SHELL_X.right - SHELL_X.left, HEIGHT - ROOF),
  );
};
