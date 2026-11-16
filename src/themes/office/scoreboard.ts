import { mix } from './hash.ts';

export type Sport = 'SQ' | 'RB';

export interface Score {
  sport: Sport;
  a: number;
  b: number;
}

export const SPORT_NAMES: Readonly<Record<Sport, string>> = { SQ: 'Squash', RB: 'Racquetball' };

/** Games to 11 (squash) or 15 (racquetball), win by two. */
const TARGETS: Readonly<Record<Sport, number>> = { SQ: 11, RB: 15 };
const SECONDS_PER_POINT = 2;
/** Each game gets this many points of clock; a finished game holds its score until the next one starts. */
const POINTS_PER_SLOT = 40;

const isWon = (a: number, b: number, target: number): boolean => Math.max(a, b) >= target && Math.abs(a - b) >= 2;

/** The SCRD scoreboard at `now` seconds: a pure function of time, so a paused Office shows a steady score. */
export function scoreAt(now: number): Score {
  const step = Math.max(0, Math.floor(now / SECONDS_PER_POINT));
  const game = Math.floor(step / POINTS_PER_SLOT);
  const sport: Sport = game % 2 === 0 ? 'SQ' : 'RB';
  const target = TARGETS[sport];
  let a = 0;
  let b = 0;
  for (let point = 0; point < step % POINTS_PER_SLOT && !isWon(a, b, target); point++) {
    if (mix(game, point) % 100 < 52) a++;
    else b++;
  }
  return { sport, a, b };
}
