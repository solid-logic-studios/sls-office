/**
 * Renders a Theme headlessly to exact-pixel PNGs: `pnpm shot <themeId> [outDir]`.
 * Defaults to `.shots/<themeId>/`. Each shot is a scripted Simulator run drawn through the Engine.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import type { Painter, TextStyle } from '../src/contract/painter.ts';
import type { Theme } from '../src/contract/theme.ts';
import { Engine } from '../src/engine/engine.ts';
import { drawText, textWidth } from '../src/engine/pixel-font.ts';
import { seededRandom } from '../src/engine/random.ts';
import { Simulator } from '../src/simulator/simulator.ts';
import type { SimCommand } from '../src/simulator/simulator.ts';
import { THEMES } from '../src/themes/index.ts';

type Rgb = readonly [number, number, number];
type Crop = readonly [x: number, y: number, w: number, h: number];

function parseColour(colour: string): Rgb {
  const text = colour.trim();
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  }
  const fn = text.match(/^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i);
  if (fn !== null) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  throw new Error(`Unsupported colour: ${colour}`);
}

/** A software Painter over an RGB buffer: nearest-pixel rects, alpha and clipping, no antialiasing. */
class BufferPainter implements Painter {
  private readonly data: Uint8Array;
  private alpha = 1;
  private clip: Crop;

  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number, background = '#000000') {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 3);
    this.clip = [0, 0, width, height];
    const [r, g, b] = parseColour(background);
    for (let i = 0; i < width * height; i++) this.data.set([r, g, b], i * 3);
  }

  rect(colour: string, x: number, y: number, w: number, h: number): void {
    const left = Math.round(x);
    const top = Math.round(y);
    const [r, g, b] = parseColour(colour);
    const x0 = Math.max(left, this.clip[0]);
    const y0 = Math.max(top, this.clip[1]);
    const x1 = Math.min(left + w, this.clip[0] + this.clip[2]);
    const y1 = Math.min(top + h, this.clip[1] + this.clip[3]);
    const a = this.alpha;
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.width + px) * 3;
        this.data[i] = (this.data[i] ?? 0) * (1 - a) + r * a;
        this.data[i + 1] = (this.data[i + 1] ?? 0) * (1 - a) + g * a;
        this.data[i + 2] = (this.data[i + 2] ?? 0) * (1 - a) + b * a;
      }
    }
  }

  text(text: string, x: number, y: number, colour: string, style: TextStyle = {}): void {
    const bold = style.bold === true;
    const width = textWidth(text, bold);
    const shift = style.align === 'centre' ? width / 2 : style.align === 'right' ? width : 0;
    drawText((fx, fy, w, h) => this.rect(colour, fx, fy, w, h), text, Math.round(x - shift), Math.round(y), bold);
  }

  textWidth(text: string, bold = false): number {
    return textWidth(text, bold);
  }

  withAlpha(alpha: number, draw: () => void): void {
    const outer = this.alpha;
    this.alpha = outer * alpha;
    draw();
    this.alpha = outer;
  }

  withClip(x: number, y: number, w: number, h: number, draw: () => void): void {
    const outer = this.clip;
    const x0 = Math.max(x, outer[0]);
    const y0 = Math.max(y, outer[1]);
    const x1 = Math.min(x + w, outer[0] + outer[2]);
    const y1 = Math.min(y + h, outer[1] + outer[3]);
    this.clip = [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
    draw();
    this.clip = outer;
  }

  /** Encodes the (cropped) buffer as a PNG, each art pixel enlarged to `scale` by `scale` pixels. */
  png(scale: number, crop: Crop = [0, 0, this.width, this.height]): Buffer {
    const [cx, cy, cw, ch] = crop;
    const w = cw * scale;
    const h = ch * scale;
    const stride = w * 3 + 1;
    const raw = Buffer.alloc(stride * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const source = ((cy + Math.floor(y / scale)) * this.width + cx + Math.floor(x / scale)) * 3;
        raw.set(this.data.subarray(source, source + 3), y * stride + 1 + x * 3);
      }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(w, 0);
    header.writeUInt32BE(h, 4);
    header[8] = 8;
    header[9] = 2;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 255] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

interface Shot {
  name: string;
  /** Hour of day (0 to 24) the Engine draws at. */
  hour: number;
  /** Simulator commands, each followed by that many seconds of play. */
  script: readonly (SimCommand | number)[];
}

/** A number in a script is seconds to play; anything else is a command. */
const SHOTS: readonly Shot[] = [
  { name: 'day', hour: 14, script: [{ kind: 'preset', preset: 'arvo' }, 31] },
  { name: 'deploy', hour: 10.5, script: [{ kind: 'preset', preset: 'deploy' }, 9] },
  {
    name: 'alarm',
    hour: 16,
    script: [{ kind: 'preset', preset: 'fire' }, 14, { kind: 'set-up', vmId: 'sls-data', up: false }, 4],
  },
  { name: 'night', hour: 2.5, script: [{ kind: 'preset', preset: 'quiet' }, 30] },
];

const SCALE = 2;

function render(theme: Theme, shot: Shot): Buffer {
  const sim = new Simulator({ random: seededRandom(11), now: () => new Date(Date.UTC(2026, 10, 23, 3)) });
  const engine = new Engine(theme, { random: seededRandom(7) });
  engine.setHour(shot.hour);
  const play = (seconds: number): void => {
    for (let s = 0; s < seconds; s++) {
      sim.advance(1);
      engine.accept(sim.snapshot());
      engine.update(1);
    }
  };
  play(2);
  for (const step of shot.script) {
    if (typeof step === 'number') play(step);
    else sim.dispatch(step);
  }
  const { width, height } = theme.layout;
  const painter = new BufferPainter(width, height);
  engine.draw(painter);
  return painter.png(SCALE);
}

const [themeId, outArg] = process.argv.slice(2);
const theme = THEMES.find((candidate) => candidate.id === themeId);
if (theme === undefined) {
  console.error(`Usage: pnpm shot <themeId> [outDir]   (themes: ${THEMES.map((t) => t.id).join(', ')})`);
  process.exit(1);
}
const out = outArg ?? join('.shots', theme.id);
mkdirSync(out, { recursive: true });
for (const shot of SHOTS) writeFileSync(join(out, `${theme.id}-${shot.name}.png`), render(theme, shot));
console.log(`Wrote ${SHOTS.length} shots to ${out}`);
