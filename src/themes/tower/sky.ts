import type { Painter } from '../../contract/painter.ts';
import type { DecorFn, StageView } from '../../contract/theme.ts';
import { lerp, pen } from '../shared/pen.ts';
import { nightFactor, skyColour } from '../shared/sky.ts';
import { HEIGHT, ROOF, WIDTH } from './geometry.ts';

/**
 * The Office's sky, narrowed to the Tower: the same colours by hour, behind the whole stage so a
 * window low in the building shows the horizon. The sun and moon cross the strip above the roof.
 */

const BANDS = 8;
const BAND_HEIGHT = Math.ceil(HEIGHT / BANDS);

const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 53.7) % WIDTH, y: (i * 97.3) % HEIGHT, k: i % 5 }));
const CLOUDS = [
  { x: 10, y: 10, speed: 2.5 },
  { x: 120, y: 22, speed: 3.5 },
  { x: 200, y: 6, speed: 3 },
] as const;

function paintNight(painter: Painter, now: number, night: number): void {
  const { R } = pen(painter);
  painter.withAlpha(night, () => {
    for (const s of STARS) if (Math.floor(now * 0.7 + s.k * 1.3) % 7 !== s.k) R('#ffffff', s.x, s.y, 1, 1);
    // Crescent moon, at the top left above the roof.
    R('#f4f1d8', 6, 6, 9, 9);
    R(skyColour(23, 0), 9, 5, 8, 8);
  });
}

/** The sun rises at the left edge and sets at the right, peaking just under the top of the stage. */
function paintSun(painter: Painter, hour: number): void {
  if (hour <= 5.8 || hour >= 18.8) return;
  const { R } = pen(painter);
  const a = (hour - 5.8) / 13;
  const x = lerp(-6, WIDTH + 6, a);
  const y = ROOF - 4 - Math.sin(a * Math.PI) * (ROOF - 12);
  R('#fff2a8', x - 5, y - 5, 11, 11);
  R('#ffd84a', x - 4, y - 4, 9, 9);
}

function paintClouds(painter: Painter, now: number, night: number): void {
  const { R } = pen(painter);
  const body = night > 0.5 ? '#3a4670' : '#ffffff';
  const shade = night > 0.5 ? '#2c3760' : '#dcecf6';
  for (const c of CLOUDS) {
    const x = ((c.x + now * c.speed) % (WIDTH + 40)) - 30;
    R(shade, x, c.y + 3, 20, 2);
    R(body, x, c.y, 20, 4);
    R(body, x + 3, c.y - 3, 11, 3);
  }
}

export const paintSky: DecorFn = (painter, { hour, now }) => {
  const night = nightFactor(hour);
  for (let i = 0; i < BANDS; i++)
    painter.rect(skyColour(hour, i / (BANDS - 1)), 0, i * BAND_HEIGHT, WIDTH, BAND_HEIGHT);
  if (night > 0) paintNight(painter, now, night);
  paintSun(painter, hour);
  paintClouds(painter, now, night);
};

/** Lets the sky show through a window or a door in the building. */
export function openToSky(painter: Painter, stage: StageView, x: number, y: number, w: number, h: number): void {
  painter.withClip(x, y, w, h, () => paintSky(painter, stage));
}

/** A window in a back wall: the sky through the glass, then the frame. */
export function paintWindow(painter: Painter, stage: StageView, x: number, y: number, w: number, h: number): void {
  const { R } = pen(painter);
  openToSky(painter, stage, x, y, w, h);
  R('#f4f1e6', x - 1, y - 1, w + 2, 1);
  R('#f4f1e6', x - 1, y + h, w + 2, 2);
  R('#f4f1e6', x - 1, y, 1, h);
  R('#f4f1e6', x + w, y, 1, h);
  R('#f4f1e6', x + (w >> 1), y, 1, h);
}
