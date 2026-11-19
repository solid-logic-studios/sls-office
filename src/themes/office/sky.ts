import type { Painter } from '../../contract/painter.ts';
import type { DecorFn, StageView } from '../../contract/theme.ts';
import { clamp, lerp, pen } from './pen.ts';

export const WIDTH = 660;

type Rgb = readonly [number, number, number];

/** Sky colour keyframes by hour: [hour, top of the sky, bottom of the sky]. */
const KEYFRAMES: readonly (readonly [number, Rgb, Rgb])[] = [
  [0, [10, 14, 44], [26, 34, 80]],
  [5, [10, 14, 44], [26, 34, 80]],
  [6.2, [70, 90, 160], [244, 160, 110]],
  [8, [86, 170, 232], [190, 228, 250]],
  [16.5, [86, 170, 232], [190, 228, 250]],
  [18.3, [110, 80, 150], [246, 150, 90]],
  [19.8, [10, 14, 44], [26, 34, 80]],
  [24, [10, 14, 44], [26, 34, 80]],
];

const BANDS = 9;

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = ([r, g, b]: Rgb): string => `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;

/** The sky colour at `hour`, a share `t` of the way from the top of the sky (0) to the bottom (1). */
export function skyColour(hour: number, t: number): string {
  let i = 0;
  while (i < KEYFRAMES.length - 2 && hour >= (KEYFRAMES[i + 1]?.[0] ?? 24)) i++;
  const from = KEYFRAMES[i];
  const to = KEYFRAMES[i + 1];
  if (!from || !to) return css([0, 0, 0]);
  const k = clamp((hour - from[0]) / (to[0] - from[0]), 0, 1);
  return css(mixRgb(mixRgb(from[1], to[1], k), mixRgb(from[2], to[2], k), t));
}

function paintBands(painter: Painter, hour: number): void {
  for (let band = 0; band < BANDS; band++) {
    painter.rect(skyColour(hour, band / (BANDS - 1)), 0, band * 30, WIDTH, 30);
  }
}

/** 0 by day, 1 at night, easing through dawn and dusk. */
export const nightFactor = (h: number): number =>
  h < 5 || h >= 19.8 ? 1 : h < 6.5 ? (6.5 - h) / 1.5 : h > 18.3 ? (h - 18.3) / 1.5 : 0;

const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 137.5) % WIDTH, y: (i * 61.3) % 236, k: i % 5 }));
const CLOUDS = Array.from({ length: 6 }, (_, i) => ({
  x: i * 130 + ((i * 37) % 60),
  y: [6, 18, 70, 120, 170, 12][i] ?? 6,
  speed: 2.5 + ((i * 7) % 5) * 0.5,
}));

function paintNightSky(painter: Painter, now: number, night: number): void {
  const { R } = pen(painter);
  painter.withAlpha(night, () => {
    for (const s of STARS) if (Math.floor(now * 0.7 + s.k * 1.3) % 7 !== s.k) R('#ffffff', s.x, s.y, 1, 1);
    // Southern Cross and the Pointers.
    for (const [dx, dy] of [
      [0, 0],
      [1, 14],
      [-5, 6],
      [5, 5],
    ] as const) {
      R('#ffffff', 624 + dx, 10 + dy, 2, 2);
    }
    R('#d8e6ff', 627, 18, 1, 1);
    R('#ffffff', 600, 22, 2, 2);
    R('#ffffff', 590, 25, 2, 2);
    // Crescent moon.
    R('#f4f1d8', 584, 36, 9, 9);
    R('rgb(14,18,52)', 587, 35, 8, 8);
  });
}

function paintSun(painter: Painter, hour: number): void {
  if (hour <= 5.8 || hour >= 18.8) return;
  const { R } = pen(painter);
  const a = (hour - 5.8) / 13;
  const x = lerp(-10, 650, a);
  const y = 206 - Math.sin(a * Math.PI) * 186;
  R('#fff2a8', x - 5, y - 5, 11, 11);
  R('#ffd84a', x - 4, y - 4, 9, 9);
}

function paintClouds(painter: Painter, now: number, night: number): void {
  const { R } = pen(painter);
  const body = night > 0.5 ? '#3a4670' : '#ffffff';
  const shade = night > 0.5 ? '#2c3760' : '#dcecf6';
  for (const c of CLOUDS) {
    const x = ((c.x + now * c.speed) % (WIDTH + 60)) - 40;
    R(shade, x, c.y + 3, 22, 2);
    R(body, x, c.y, 22, 4);
    R(body, x + 3, c.y - 3, 12, 3);
    R(body, x + 9, c.y - 5, 7, 2);
  }
}

/** The whole sky: bands, stars, Southern Cross, moon, sun and drifting clouds. */
export const paintSky: DecorFn = (painter, { hour, now }) => {
  const night = nightFactor(hour);
  paintBands(painter, hour);
  if (night > 0) paintNightSky(painter, now, night);
  paintSun(painter, hour);
  paintClouds(painter, now, night);
};

/** SMP Buildcrete's branch office, floating on a cloud beside the building. */
export const paintCloudOffice: DecorFn = (painter, { hour, now }) => {
  const { R, T } = pen(painter);
  const cy = 96 + Math.round(Math.sin(now * 0.8) * 2);
  const text = nightFactor(hour) > 0.5 ? '#e4edf2' : '#1b2632';
  R('#ffffff', 586, cy, 58, 10);
  R('#ffffff', 590, cy - 5, 22, 6);
  R('#ffffff', 606, cy - 8, 24, 9);
  R('#ffffff', 626, cy - 4, 14, 5);
  R('#d9e6ee', 588, cy + 8, 54, 2);
  R('#a9a59c', 600, cy - 24, 28, 17);
  R('#8d8a84', 600, cy - 9, 28, 2);
  R('#0b6fd6', 598, cy - 27, 32, 3);
  R('#0b6fd6', 628, cy - 33, 3, 5);
  R('#5aa9f0', 629, cy - 32, 1, 2);
  R('#bfe6fa', 604, cy - 20, 9, 8);
  R('#e0a878', 606, cy - 17, 4, 5);
  R('#2a1d14', 606, cy - 18, 4, 1);
  R('#6e4f35', 618, cy - 17, 6, 8);
  T('SMP BUILDCRETE', 614, cy + 20, text, 'centre');
  T('LEGACY DROPLET', 614, cy + 29, text, 'centre');
};

/** Lets the sky show through a window or door in the building. */
export function openToSky(painter: Painter, stage: StageView, x: number, y: number, w: number, h: number): void {
  painter.withClip(x, y, w, h, () => paintSky(painter, stage));
}
