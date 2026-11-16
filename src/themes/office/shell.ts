import type { Painter } from '../../contract/painter.ts';
import type { StageView } from '../../contract/theme.ts';
import { paintDoorways } from './doorways.ts';
import { FLOOR_BANDS, SHELL } from './floor-bands.ts';
import { pen } from './pen.ts';
import { openToSky } from './sky.ts';

const STAGE_WIDTH = 660;

/** The rooftop sign: 'SOLID LOGIC STUDIOS' is 133 px in bold, and the board's face is 146 px. */
export const ROOF_SIGN = { x: 196, y: 8, w: 150, h: 20, text: 'SOLID LOGIC STUDIOS' } as const;

export function paintGroundAndShell(painter: Painter): void {
  const { R, T } = pen(painter);
  // Ground and the path to the vault.
  R('#4d8b4f', 0, 244, STAGE_WIDTH, 3);
  R('#3f7a44', 0, 247, STAGE_WIDTH, 2);
  R('#6a4b36', 0, 249, STAGE_WIDTH, 21);
  R('#9c9588', 566, 243, 94, 2);
  // Shell, roof, basement.
  R(SHELL, 8, 40, 560, 208);
  R('#8a4a44', 4, 32, 568, 8);
  R('#a85d52', 4, 32, 568, 2);
  R('#262231', 8, 248, 560, 22);
  R('#1b1824', 8, 248, 560, 1);
  // Rooftop: sign, antenna, air con.
  R('#2a2533', ROOF_SIGN.x, ROOF_SIGN.y, ROOF_SIGN.w, ROOF_SIGN.h);
  R('#4a4266', ROOF_SIGN.x + 2, ROOF_SIGN.y + 2, ROOF_SIGN.w - 4, ROOF_SIGN.h - 4);
  R('#2a2533', 214, 28, 3, 4);
  R('#2a2533', 326, 28, 3, 4);
  T(ROOF_SIGN.text, ROOF_SIGN.x + ROOF_SIGN.w / 2, 21, '#f2c230', 'centre', true);
  R('#8d94a0', 520, 10, 1, 22);
  R('#8d94a0', 516, 16, 9, 1);
  R('#aab2ba', 56, 24, 22, 8);
  R('#7d8a9a', 58, 26, 18, 2);
  R('#7d8a9a', 58, 29, 18, 2);
}

/** One room's back wall, skirting, floor and floorboards. */
function paintRoom(
  painter: Painter,
  [x0, x1]: readonly [number, number],
  floor: number,
  colours: { wall: string; shade: string; floor: string; line: string },
): void {
  const { R } = pen(painter);
  const band = FLOOR_BANDS[floor];
  if (!band) return;
  const w = x1 - x0;
  R(colours.wall, x0, band.ceil, w, band.back - band.ceil);
  R(colours.shade, x0, band.back - 9, w, 8);
  R('#2a2533', x0, band.back - 1, w, 1);
  R(colours.floor, x0, band.back, w, band.front - band.back);
  for (let x = x0 + 6; x < x1; x += 16) R(colours.line, x, band.back + 1, 1, band.front - band.back - 1);
  R(colours.line, x0, band.back + 8, w, 1);
}

const WOOD = { floor: '#a8794f', line: '#946740' };
const DARK_WOOD = { floor: '#7a5a3c', line: '#6a4c30' };

export function paintRooms(painter: Painter): void {
  paintRoom(painter, [14, 140], 1, { wall: '#b7d3c2', shade: '#9fbfad', ...WOOD });
  paintRoom(painter, [144, 270], 1, { wall: '#cdbb9c', shade: '#b7a585', ...WOOD });
  paintRoom(painter, [274, 442], 1, { wall: '#e6d6b4', shade: '#d2c09a', ...WOOD });
  paintRoom(painter, [474, 562], 1, { wall: '#34335f', shade: '#2b2a50', ...DARK_WOOD });
  paintRoom(painter, [14, 442], 0, { wall: '#d3e0e8', shade: '#bccdd8', floor: '#7f8fa3', line: '#72829a' });
  paintRoom(painter, [474, 562], 0, { wall: '#b9b4aa', shade: '#a5a096', floor: '#8d8a84', line: '#7d7a74' });
}

export function paintLift(painter: Painter): void {
  const { R, T } = pen(painter);
  R('#1c1926', 446, 44, 24, 200);
  R('#2c2838', 457, 44, 2, 200);
  for (const x of [442, 470]) {
    R(SHELL, x, 44, 4, 76);
    R(SHELL, x, 150, 4, 78);
  }
  R('#55506a', 446, 44, 24, 3);
  R('#55506a', 446, 150, 24, 3);
  // 'LIFT' is 24 px, exactly the width of the shaft.
  T('LIFT', 446, 58, '#7f7a94');
  paintDoorways(painter);
}

export function paintCeilingLights(painter: Painter): void {
  const { R } = pen(painter);
  for (const x of [40, 100, 160, 220, 280, 340]) R('#f6f2c8', x, 151, 14, 2);
  for (const x of [60, 190, 330, 400]) R('#f6f2c8', x, 45, 14, 2);
  R('#f6f2c8', 510, 151, 14, 2);
  R('#e84f8a', 474, 45, 88, 1);
}

/** The front door and the loading bay door: two openings in the shell that show the sky and stay clear. */
export function paintExits(painter: Painter, stage: StageView): void {
  const { R } = pen(painter);
  openToSky(painter, stage, 8, 204, 6, 40);
  R('#5a4a3a', 7, 201, 8, 3);
  R('#a23f38', 15, 241, 16, 2);
  openToSky(painter, stage, 562, 198, 6, 46);
  R('#777f88', 560, 193, 9, 5);
  R('#5c636b', 560, 196, 9, 1);
}

/** A window in the back wall: the sky shows through the glass, then the frame. */
export function paintWindow(painter: Painter, stage: StageView, x: number, y: number, w: number, h: number): void {
  const { R } = pen(painter);
  openToSky(painter, stage, x, y, w, h);
  R('#f4f1e6', x - 2, y - 2, w + 4, 2);
  R('#f4f1e6', x - 2, y + h, w + 4, 3);
  R('#f4f1e6', x - 2, y, 2, h);
  R('#f4f1e6', x + w, y, 2, h);
  R('#f4f1e6', x + (w >> 1) - 1, y, 2, h);
  R('#f4f1e6', x, y + (h >> 1) - 1, w, 2);
  R('#b9b29c', x - 2, y + h + 3, w + 4, 1);
}
