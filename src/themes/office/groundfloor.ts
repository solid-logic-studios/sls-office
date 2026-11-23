import type { Painter } from '../../contract/painter.ts';
import type { StageView } from '../../contract/theme.ts';
import { PLAQUE, REPLACE_NOTE } from './boards.ts';
import { pen } from '../shared/pen.ts';
import { paintWindow } from './shell.ts';

/** Static art for the ground floor, the basement and the off-site vault. */

function paintPlaque(painter: Painter): void {
  const { R, T } = pen(painter);
  const { x, y, w, h } = PLAQUE;
  const mid = x + w / 2;
  R('#7a5a1c', x, y, w, h);
  R('#d9b24c', x + 2, y + 2, w - 4, h - 4);
  R('#edd27a', x + 2, y + 2, w - 4, 1);
  R('#b8892f', x + 2, y + h - 4, w - 4, 1);
  for (const [sx, sy] of [
    [x + 4, y + 4],
    [x + w - 6, y + 4],
    [x + 4, y + h - 8],
    [x + w - 6, y + h - 8],
  ] as const) {
    R('#7a5a1c', sx, sy, 2, 2);
  }
  T('OUR FIRST CLIENT', mid, 172, '#5a3f0c', 'centre');
  T('SMP BUILDCRETE', mid, 181, '#3a2806', 'centre', true);
}

function paintSquashRack(painter: Painter): void {
  const { R, T } = pen(painter);
  R('#8a6442', 250, 159, 34, 32);
  R('#a87c54', 251, 160, 32, 30);
  // Squash racquet.
  R('#e0563f', 255, 162, 7, 1);
  R('#e0563f', 254, 163, 1, 8);
  R('#e0563f', 262, 163, 1, 8);
  R('#e0563f', 255, 171, 7, 1);
  R('#f4f1e6', 255, 163, 7, 8);
  for (let i = 0; i < 3; i++) {
    R('#c9c2b0', 257 + i * 2, 163, 1, 8);
    R('#c9c2b0', 255, 165 + i * 2, 7, 1);
  }
  R('#2a2533', 258, 172, 1, 13);
  R('#f4f1e6', 258, 182, 1, 3);
  // Racquetball racquet, and one of each ball.
  R('#3f8fd0', 269, 165, 7, 1);
  R('#3f8fd0', 268, 166, 1, 6);
  R('#3f8fd0', 276, 166, 1, 6);
  R('#3f8fd0', 269, 172, 7, 1);
  R('#f4f1e6', 269, 166, 7, 6);
  R('#2a2533', 272, 173, 1, 7);
  R('#111111', 264, 186, 3, 3);
  R('#f2c230', 265, 187, 1, 1);
  R('#2d6fd0', 274, 184, 4, 4);
  R('#7fb0f0', 275, 185, 1, 1);
  T('SCRD', 255, 200, '#586878');
}

/** The wall boards for the scoreboard, Healthchecks.io and the clock; the screens animate in the dressing. */
function paintWallBoards(painter: Painter): void {
  const { R, T } = pen(painter);
  R('#39424d', 288, 158, 66, 30);
  R('#39424d', 358, 158, 42, 26);
  T('HC.IO', 364, 193, '#586878');
  R('#39424d', 402, 158, 38, 16);
  R('#8d94a0', 22, 180, 8, 2);
}

/** The worn NVMe shows in the building: a crack by the flickering light. */
function paintCrack(painter: Painter): void {
  const { R } = pen(painter);
  for (const [x, y] of [
    [430, 152],
    [431, 154],
    [430, 156],
    [432, 158],
    [433, 160],
    [432, 162],
    [434, 164],
    [433, 166],
    [435, 168],
    [436, 170],
  ] as const) {
    R('#8a9aa6', x, y, 1, 2);
  }
  R('#8a9aa6', 434, 160, 3, 1);
  R('#8a9aa6', 429, 157, 2, 1);
}

function paintWaterCooler(painter: Painter): void {
  const { R } = pen(painter);
  R('#e9eef2', 426, 216, 10, 12);
  R('#bfe6fa', 427, 205, 8, 11);
  R('#dff3fd', 428, 206, 2, 7);
  R('#3f8fd0', 429, 219, 2, 2);
}

export function paintComputeFloor(painter: Painter, stage: StageView): void {
  const { T } = pen(painter);
  T('SLS-COMPUTE', 18, 163, '#586878');
  paintPlaque(painter);
  paintWindow(painter, stage, 204, 160, 36, 30);
  paintSquashRack(painter);
  paintWallBoards(painter);
  paintCrack(painter);
  paintWaterCooler(painter);
}

export function paintLoadingBay(painter: Painter): void {
  const { R, T } = pen(painter);
  T('SLS-DEPLOY', 478, 163, '#5c5850');
  for (let x = 474; x < 562; x += 8) {
    R('#f2c230', x, 222, 4, 5);
    R('#2a2533', x + 4, 222, 4, 5);
  }
  R('#c9955a', 536, 212, 20, 16);
  R('#a8743c', 536, 212, 20, 1);
  R('#e6c48a', 545, 212, 2, 16);
  R('#c9955a', 540, 197, 16, 15);
  R('#a8743c', 540, 197, 16, 1);
  R('#e6c48a', 547, 197, 2, 15);
  R('#b98a5a', 518, 216, 16, 12);
  R('#a8743c', 518, 216, 16, 1);
  T('GHCR', 520, 190, '#5c5850');
  R('#6e4f35', 480, 176, 30, 2);
  R('#e0563f', 483, 170, 5, 6);
  R('#3f8fd0', 491, 172, 6, 4);
  R('#8d94a0', 500, 169, 3, 7);
}

/** The basement: the Proxmox host itself. The bars, LEDs and disks animate in the dressing. */
export function paintBasement(painter: Painter): void {
  const { R, T } = pen(painter);
  T('PVE', 14, 262, '#9fe8e0', 'left', true);
  T('OPTIPLEX 7070 MICRO', 40, 262, '#7f7a94');
  T('CPU', 164, 262, '#7f7a94');
  R('#14121c', 186, 255, 46, 8);
  T('MEM', 240, 262, '#7f7a94');
  R('#14121c', 264, 255, 46, 8);
  T('SSD', 320, 262, '#7f7a94');
  T('NVME', 354, 262, '#7f7a94');
  // The sticky note: 'JAN 2027' is 48 px, and the face is 62.
  const { x, y, w, h } = REPLACE_NOTE;
  R('#c9b84e', x + 1, y + 1, w - 2, h - 1);
  R('#f6e27a', x, y, w - 2, h - 1);
  T('REPLACE', x + 3, 258, '#5a4a1c');
  T('JAN 2027', x + 3, 266, '#5a4a1c');
  for (const [dx, dy] of [
    [0, 2],
    [1, 3],
    [2, 2],
    [3, 1],
    [4, 0],
  ] as const) {
    R('#2f8f48', 446 + dx, 259 + dy, 1, 2);
  }
}

export function paintVault(painter: Painter): void {
  const { R, T } = pen(painter);
  R('#8d8a84', 588, 200, 58, 44);
  R('#6f6c66', 586, 196, 62, 4);
  R('#a5a29a', 588, 200, 58, 1);
  R('#7d7a74', 588, 242, 58, 2);
  T('R2 VAULT', 617, 210, '#2a2533', 'centre', true);
  R('#5c5a55', 604, 214, 26, 28);
}
