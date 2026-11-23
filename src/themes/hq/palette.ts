/**
 * The HQ palette. Every value is a CSS colour.
 *
 * Three families carry the Theme: graphite and steel for the building, amber for JARVIS and cyan for
 * the power core. Red is kept for the alarm, so it always means trouble.
 */

/** Outlines and the darkest shadows. */
export const INK = '#0b0e17';

/** Bubble-white text on dark boards. */
export const PAPER = '#eef3f8';

/** The building: hull plating outside, steel fittings inside. */
export const HULL = {
  dark: '#121826',
  base: '#1b2233',
  light: '#2a3550',
  trim: '#3d4c6b',
} as const;

export const STEEL = {
  dark: '#3a4558',
  base: '#5d6b82',
  light: '#8fa0b8',
  shine: '#c5d2e2',
} as const;

/** JARVIS: ember at rest, white-hot when it speaks. */
export const AMBER = {
  ember: '#7a2e00',
  rim: '#b84a00',
  base: '#f07a12',
  glow: '#ffa733',
  hot: '#ffd98a',
  white: '#fff6dc',
} as const;

/** The power core and everything it feeds. */
export const CYAN = {
  deep: '#0b3a52',
  base: '#1688b8',
  bright: '#49d0f2',
  hot: '#c9f6ff',
} as const;

/** The alarm. Nothing else on stage is this red. */
export const ALARM = {
  deep: '#5a0f0f',
  dark: '#a3201a',
  base: '#ff3b30',
  light: '#ff8a7a',
  white: '#ffe3de',
} as const;

/** A dead screen, an unlit cell, an empty tube. */
export const UNLIT = '#16202e';

/** Signal lamps: all clear, a warning. Critical is `ALARM.base`. */
export const LAMP = {
  ok: '#5fcf7a',
  warn: '#f0b840',
} as const;

/** The rec room couch's upholstery: back, seat, seat top and foot line. The Spire's gate couch shares it. */
export const COUCH_COLOURS = { back: '#8a3f6a', seat: '#753458', top: '#a04d7c', foot: '#5c2845' } as const;

/** One room's surfaces: the back wall, its lower shade, the floor and the floor's seams. */
export interface RoomColours {
  wall: string;
  shade: string;
  floor: string;
  line: string;
  /** The room's accent strip under the ceiling and the colour of its label. */
  accent: string;
}

const DECK_PLATE = { floor: '#6f7f96', line: '#617089' } as const;
const DARK_PLATE = { floor: '#4a566c', line: '#3f4a60' } as const;

/** Mid-dark walls, so bright suits and the two glows read against them. */
export const ROOMS = {
  rookieBay: { wall: '#2f4f56', shade: '#28444b', accent: '#7df0c0', ...DECK_PLATE },
  archive: { wall: '#3d3558', shade: '#342d4c', accent: '#b9a2f0', ...DECK_PLATE },
  command: { wall: '#222b42', shade: '#1c2438', accent: AMBER.glow, ...DARK_PLATE },
  rec: { wall: '#4a3a4a', shade: '#3f313f', accent: '#f08ab0', ...DARK_PLATE },
  ops: { wall: '#33425c', shade: '#2a3750', accent: CYAN.bright, ...DECK_PLATE },
  hangar: { wall: '#454d5a', shade: '#3a414d', accent: '#f2c230', floor: '#5a6270', line: '#4d5562' },
  sublevel: { wall: '#10141f', shade: '#0c0f18', accent: CYAN.base, floor: '#1a2030', line: '#141a28' },
} as const satisfies Record<string, RoomColours>;
