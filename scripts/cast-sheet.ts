/**
 * Renders the HQ's cast as a look sheet: `pnpm sheet [outFile] [scale]`.
 * Defaults to `.shots/hq-cast.png` at four screen pixels per art pixel. Every hero stands, walks (both
 * steps), types, sits idle and faints, on the HQ's two wall tones, drawn by the Engine's sprite renderer.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { drawLook, type Pose, type SpriteState } from '../src/engine/sprites.ts';
import { HEROES } from '../src/themes/hq/avengers.ts';
import { PAPER, ROOMS } from '../src/themes/hq/palette.ts';
import { BufferPainter } from './buffer-painter.ts';

interface Frame {
  pose: Pose;
  /** Chosen to land on the frame wanted: a walk step, a key tap, eyes open. */
  time: number;
  seated?: boolean;
  facing?: 1 | -1;
}

const FRAMES: readonly Frame[] = [
  { pose: 'stand', time: 1.3 },
  { pose: 'walk', time: 1.03 },
  { pose: 'walk', time: 1.25, facing: -1 },
  { pose: 'type', time: 1.3 },
  { pose: 'idle', time: 1.3, seated: true },
  { pose: 'faint', time: 1.3 },
];

const COLUMNS = 4;
const STEP = 22;
const CELL = { w: FRAMES.length * STEP + 12, h: 42 };
const FLOOR = 34;

/** The lightest and the darkest room a hero stands in, so a black suit is checked against both. */
const WALLS = [ROOMS.ops, ROOMS.command] as const;

const [outArg, scaleArg] = process.argv.slice(2);
const out = outArg ?? '.shots/hq-cast.png';
const scale = Number(scaleArg ?? 4);

const rows = Math.ceil(HEROES.length / COLUMNS);
const painter = new BufferPainter(COLUMNS * CELL.w, rows * CELL.h);

HEROES.forEach((hero, index) => {
  const left = (index % COLUMNS) * CELL.w;
  const top = Math.floor(index / COLUMNS) * CELL.h;
  const room = WALLS[(index + Math.floor(index / COLUMNS)) % WALLS.length] ?? ROOMS.ops;
  painter.rect(room.wall, left, top, CELL.w, FLOOR);
  painter.rect(room.floor, left, top + FLOOR, CELL.w, CELL.h - FLOOR);
  painter.text(hero.name.toUpperCase(), left + 3, top + 8, PAPER);
  FRAMES.forEach((frame, column) => {
    const state: SpriteState = {
      x: left + 16 + column * STEP,
      y: top + FLOOR + 2,
      pose: frame.pose,
      facing: frame.facing ?? 1,
      time: frame.time,
      frantic: false,
      talking: false,
      seated: frame.seated ?? false,
      inLift: false,
      trolley: null,
    };
    drawLook(painter, hero.look, state);
  });
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, painter.png(scale));
console.log(`Wrote ${HEROES.length} looks to ${out}`);
