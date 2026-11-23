import type { Painter } from '../../contract/painter.ts';
import type { Rect, StageView } from '../../contract/theme.ts';
import { LAN_BOARD, MYSQL_CABINET, POSTGRES_CABINET } from './boards.ts';
import { pen } from '../shared/pen.ts';
import type { Pen } from '../shared/pen.ts';
import { paintWindow } from './shell.ts';

/** Static art for the first floor: the intern pool, the archive, the founders' office and the LAN corner. */

export function paintInternPool(painter: Painter, stage: StageView): void {
  const { R, T } = pen(painter);
  T('SLS-CI', 18, 56, '#3f6a55');
  paintWindow(painter, stage, 22, 64, 26, 24);
  R('#8a8f98', 62, 60, 62, 30);
  R('#eef3f5', 64, 62, 58, 26);
  T('CI QUEUE', 67, 71, '#586878');
  R('#e0563f', 67, 75, 22, 3);
  R('#3f8fd0', 67, 80, 34, 3);
  R('#4aa86b', 67, 85, 14, 3);
}

function cabinet({ R }: Pen, rect: Rect, body: string, face: string): void {
  const { x } = rect;
  R(body, x, 74, 30, 46);
  for (let i = 0; i < 3; i++) {
    R(face, x + 1, 75 + i * 15, 28, 13);
    R('#39424d', x + 12, 81 + i * 15, 6, 2);
    R('#f4f1e6', x + 11, 77 + i * 15, 8, 2);
  }
}

export function paintArchive(painter: Painter): void {
  const pn = pen(painter);
  const { R, T } = pn;
  T('SLS-DATA', 148, 56, '#6e5a3a');
  // Each label board is the text width plus 4 px, so it always fits.
  R('#f4f1e6', 148, 61, painter.textWidth('POSTGRESQL') + 4, 9);
  T('POSTGRESQL', 150, 68, '#2f5f95');
  R('#f4f1e6', 216, 61, painter.textWidth('MYSQL') + 4, 9);
  T('MYSQL', 218, 68, '#a86414');
  cabinet(pn, POSTGRES_CABINET, '#476a94', '#6f93bf');
  cabinet(pn, MYSQL_CABINET, '#a8703a', '#d19a5c');
  R('#5c6877', 254, 108, 13, 12);
  R('#7d8a9a', 254, 108, 13, 1);
  R('#e2b84a', 259, 112, 3, 4);
  R('#5c6877', 256, 97, 11, 11);
  R('#7d8a9a', 256, 97, 11, 1);
  R('#e2b84a', 260, 101, 3, 4);
}

export function paintFoundersOffice(painter: Painter, stage: StageView): void {
  const { R, T } = pen(painter);
  T('SLS HQ', 278, 56, '#8a744a');
  paintWindow(painter, stage, 296, 62, 40, 28);
  // Plant pot (the leaves sway in the dressing), coffee counter and machine.
  R('#a5573f', 345, 112, 8, 8);
  R('#8a4630', 345, 112, 8, 1);
  R('#8a6442', 354, 106, 26, 14);
  R('#c9a777', 354, 104, 26, 2);
  R('#2f3340', 356, 89, 12, 15);
  R('#4a5062', 357, 90, 10, 4);
  R('#e0523f', 358, 96, 2, 2);
  R('#15151f', 360, 99, 4, 4);
  R('#ffffff', 371, 100, 3, 4);
  R('#e9c46a', 375, 100, 3, 4);
  // Fridge, with the kids' drawings on the door.
  R('#dfe6ea', 382, 78, 16, 42);
  R('#aab4bb', 382, 94, 16, 1);
  R('#7b858c', 396, 82, 1, 8);
  R('#7b858c', 396, 98, 1, 10);
  R('#ffffff', 384, 81, 7, 8);
  R('#f2c230', 385, 82, 2, 2);
  R('#d2443c', 388, 85, 1, 3);
  R('#4aa86b', 384, 88, 7, 1);
  R('#e0523f', 386, 80, 2, 1);
  R('#ffffff', 389, 99, 6, 7);
  R('#3f8fd0', 390, 102, 4, 3);
  R('#d2443c', 390, 101, 4, 1);
  R('#9a68d0', 391, 98, 2, 1);
  // The LAN Saturday board, with its sticky notes.
  R('#b98a5a', LAN_BOARD.x, LAN_BOARD.y, LAN_BOARD.w, LAN_BOARD.h);
  R('#fff7c9', LAN_BOARD.x + 2, LAN_BOARD.y + 2, LAN_BOARD.w - 4, 9);
  T('LAN SAT', LAN_BOARD.x + LAN_BOARD.w / 2, 69, '#3b3350', 'centre');
  R('#e0523f', 420, 61, 2, 2);
  R('#bfe6fa', 406, 73, 6, 4);
  R('#f4c6d0', 416, 72, 7, 5);
  R('#c9f0c0', 428, 73, 8, 4);
  // Putting green, flag and trophy.
  R('#3f9a52', 400, 126, 40, 7);
  R('#58b56a', 400, 126, 40, 1);
  R('#2f7f42', 400, 132, 40, 1);
  R('#1c2b20', 434, 129, 2, 1);
  R('#e8e8ee', 435, 113, 1, 16);
  R('#e0523f', 436, 113, 5, 3);
  T('FORE!', 399, 96, '#8a744a');
  R('#e2b84a', 430, 86, 6, 7);
  R('#e2b84a', 431, 93, 4, 2);
  R('#8a6a1c', 429, 95, 8, 1);
}

export function paintLanCorner(painter: Painter): void {
  const { R, T } = pen(painter);
  T('LAN CORNER', 478, 56, '#9fe8e0');
  // Original sci-fi poster.
  R('#c9c2e8', 478, 62, 28, 36);
  R('#0e1230', 479, 63, 26, 34);
  R('#e06a4f', 495, 67, 7, 7);
  R('#f2c230', 491, 70, 15, 1);
  R('#ffffff', 482, 66, 1, 1);
  R('#ffffff', 487, 72, 1, 1);
  R('#ffffff', 501, 78, 1, 1);
  R('#2b7f7a', 483, 88, 18, 9);
  R('#3aa7a0', 487, 78, 10, 10);
  R('#e84f8a', 489, 81, 6, 3);
  R('#9fe8e0', 489, 81, 2, 1);
  // Telly and its shelf (the screen animates in the dressing).
  R('#15151f', 512, 62, 40, 24);
  R('#2a2a38', 530, 86, 4, 3);
  R('#22222e', 518, 89, 28, 3);
  R('#e8e8ee', 521, 86, 8, 3);
  R('#7df0c0', 522, 87, 1, 1);
  R('#2f3340', 536, 87, 6, 2);
  // Rug, couch back and gaming rig.
  R('#7a3f6a', 480, 123, 74, 11);
  R('#8f4f7f', 482, 125, 70, 7);
  R('#b5483f', 484, 106, 50, 16);
  R('#d0584c', 484, 106, 50, 2);
  R('#9c3b35', 484, 112, 3, 10);
  R('#9c3b35', 531, 112, 3, 10);
  R('#1d1d2a', 541, 100, 14, 20);
  R('#2f2f44', 543, 102, 10, 6);
}
