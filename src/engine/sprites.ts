import type { Painter } from '../contract/painter.ts';
import type { BoxLook, Look, PersonLook } from '../contract/theme.ts';

/** How a character holds itself. Walking and fainting come from its state; the rest from its behaviour. */
export type Pose = 'stand' | 'walk' | 'type' | 'idle' | 'faint';

/** Something wheeled in a scene. */
export type Trolley = 'parcel' | 'strongbox';

/** Everything the sprite renderer needs to draw one character for one frame. */
export interface SpriteState {
  x: number;
  /** The feet. */
  y: number;
  pose: Pose;
  facing: 1 | -1;
  /** Seconds, offset per character so nobody moves in lockstep. */
  time: number;
  frantic: boolean;
  talking: boolean;
  seated: boolean;
  inLift: boolean;
  trolley: Trolley | null;
}

export interface Bounds {
  /** Half the hover width either side of `x`. */
  half: number;
  /** Hover height above the feet. */
  height: number;
}

const INK = '#1d1a26';
const LIFT_FLOOR = '#8d94a0';
const STAR = '#f2c230';
const MOUTH = '#7a2f2f';
const CUP = '#f4f1e6';
const COFFEE = '#6e4f35';
const GLASSES = '#39424d';
const HARDHAT = '#f2c230';
const HARDHAT_BRIM = '#d9a81c';
const VEST_STRIPE = '#e8eef2';
const TROLLEY = '#555b66';

const PERSON_BOUNDS: Bounds = { half: 8, height: 24 };

/** The one sprite renderer: draws any Look in any pose. */
export function drawLook(painter: Painter, look: Look, state: SpriteState): void {
  const x = Math.round(state.x);
  const y = Math.round(state.y);
  if (state.inLift) painter.rect(LIFT_FLOOR, x - 8, y, 16, 2);
  switch (look.kind) {
    case 'person':
      drawPerson(painter, look, state, x, y);
      return;
    case 'box':
      drawBox(painter, look, state, x, y);
      return;
    default: {
      const unreachable: never = look;
      throw new Error(`Unknown look ${String(unreachable)}`);
    }
  }
}

export function boundsOf(look: Look): Bounds {
  switch (look.kind) {
    case 'person':
      return PERSON_BOUNDS;
    case 'box':
      return { half: Math.ceil(look.w / 2) + 1, height: look.h + 2 };
    default: {
      const unreachable: never = look;
      throw new Error(`Unknown look ${String(unreachable)}`);
    }
  }
}

/* -------------------------------------------------------------------- person */

function drawPerson(painter: Painter, look: PersonLook, state: SpriteState, x: number, y: number): void {
  const rect = (colour: string, rx: number, ry: number, w: number, h: number): void =>
    painter.rect(colour, Math.round(rx), Math.round(ry), w, h);
  const t = state.time;

  if (state.pose === 'faint') {
    rect(look.pants, x - 9, y - 3, 6, 3);
    rect(look.shirt, x - 3, y - 4, 7, 4);
    rect(look.skin, x + 4, y - 6, 6, 6);
    rect(look.hair, x + 8, y - 6, 2, 6);
    rect(INK, x + 5, y - 4, 1, 1);
    rect(INK, x + 7, y - 4, 1, 1);
    for (let i = 0; i < 3; i++) {
      const angle = t * 4 + i * 2.1;
      rect(STAR, x + 7 + Math.cos(angle) * 6, y - 10 + Math.sin(angle) * 2, 1, 1);
    }
    return;
  }

  const walking = state.pose === 'walk';
  const typing = state.pose === 'type';
  const idle = state.pose === 'idle';
  const step = walking ? Math.floor(t * 9) % 4 : 0;
  const tap = typing ? Math.floor(t * (state.frantic ? 16 : 7)) % 2 : 0;
  const wide = look.wide === true ? 1 : 0;
  const bob = (walking && step % 2 === 1) || (typing && state.frantic && tap === 1) ? 1 : 0;
  const body = y - bob;

  // Legs and feet.
  rect(look.pants, x - 4, y - 6, 3, step === 1 ? 5 : 6);
  rect(look.pants, x + 1, y - 6, 3, step === 3 ? 5 : 6);
  rect(INK, x - 4, y - (step === 1 ? 2 : 1), 3, 1);
  rect(INK, x + 1, y - (step === 3 ? 2 : 1), 3, 1);

  // Torso and what is worn over it.
  rect(look.shirt, x - 4 - wide, body - 13, 8 + 2 * wide, 7);
  if (wide) rect(look.shirt, x - 6, body - 10, 12, 3);
  if (look.vest !== undefined) {
    rect(look.vest, x - 4, body - 13, 3, 7);
    rect(look.vest, x + 1, body - 13, 3, 7);
    rect(VEST_STRIPE, x - 4, body - 10, 8, 1);
  }
  if (look.trim !== undefined) rect(look.trim, x - 2, body - 13, 4, 1);
  if (look.tie !== undefined) rect(look.tie, x - 1, body - 13, 2, 5);

  // Arms: out at the keyboard, or swinging at the sides.
  if (typing) {
    rect(look.shirt, x - 6 - wide, body - 13, 2, 3);
    rect(look.shirt, x + 4 + wide, body - 13, 2, 3);
    rect(look.skin, x - 5 - wide, body - 10 + tap, 2, 1);
    rect(look.skin, x + 3 + wide, body - 9 - tap, 2, 1);
  } else {
    const left = walking && step < 2 ? 1 : 0;
    const right = walking && step >= 2 ? 1 : 0;
    rect(look.shirt, x - 6 - wide, body - 13 + left, 2, 5);
    rect(look.skin, x - 6 - wide, body - 8 + left, 2, 1);
    rect(look.shirt, x + 4 + wide, body - 13 + right, 2, 5);
    rect(look.skin, x + 4 + wide, body - 8 + right, 2, 1);
    if (idle && state.seated) {
      rect(CUP, x + 5 + wide, body - 12, 3, 3);
      rect(COFFEE, x + 6 + wide, body - 12, 1, 1);
    }
  }

  // Head.
  const headY = body - 20 + (idle && Math.sin(t * 1.3) > 0.7 ? 1 : 0);
  const glance = walking ? state.facing : 0;
  rect(look.skin, x - 4, headY, 8, 7);
  drawHair(rect, look, x, headY);
  const blink = t % 3.7 < 0.12 || (idle && state.seated && Math.sin(t * 0.4) > 0.6);
  rect(INK, x - 2 + glance, headY + (blink ? 4 : 3), 1, blink ? 1 : 2);
  rect(INK, x + 1 + glance, headY + (blink ? 4 : 3), 1, blink ? 1 : 2);
  if (look.glasses === true) rect(GLASSES, x - 3 + glance, headY + 2, 6, 1);
  if (look.headset === true) {
    rect(INK, x - 5, headY + 1, 1, 4);
    rect(INK, x - 5, headY + 5, 2, 1);
  }
  if (state.talking && Math.floor(t * 6) % 2 === 1) rect(MOUTH, x - 1 + glance, headY + 5, 2, 1);

  // Something in hand, or a trolley in front.
  if (state.trolley !== null) {
    drawTrolley(rect, state.trolley, x, y, state.facing);
  } else if (look.carry === 'clipboard') {
    rect('#8a6442', x + 4, body - 12, 5, 6);
    rect('#ffffff', x + 5, body - 11, 3, 4);
  } else if (look.carry === 'tablet') {
    rect('#2a2f3a', x + 4, body - 11, 4, 5);
    rect('#7df0c0', x + 5, body - 10, 2, 3);
  }
}

type Rect = (colour: string, x: number, y: number, w: number, h: number) => void;

function drawHair(rect: Rect, look: PersonLook, x: number, headY: number): void {
  const hair = look.hair;
  switch (look.hairStyle) {
    case 'thin':
      rect(hair, x - 4, headY - 1, 8, 2);
      rect(hair, x - 4, headY + 1, 1, 3);
      rect(hair, x + 3, headY + 1, 1, 3);
      rect(look.skin, x - 2, headY, 4, 1);
      return;
    case 'long':
      rect(hair, x - 4, headY - 1, 8, 3);
      rect(hair, x - 5, headY, 1, 8);
      rect(hair, x + 4, headY, 1, 8);
      return;
    case 'bun':
      rect(hair, x - 4, headY - 1, 8, 3);
      rect(hair, x - 4, headY + 2, 1, 2);
      rect(hair, x + 3, headY + 2, 1, 2);
      rect(hair, x - 2, headY - 3, 4, 2);
      return;
    case 'spiky':
      rect(hair, x - 4, headY, 8, 2);
      for (const dx of [-3, -1, 1, 3]) rect(hair, x + dx, headY - 2, 1, 2);
      return;
    case 'bald':
      rect(hair, x - 4, headY + 1, 1, 3);
      rect(hair, x + 3, headY + 1, 1, 3);
      return;
    case 'cap': {
      const cap = look.cap ?? hair;
      rect(cap, x - 4, headY - 2, 8, 3);
      rect(cap, x - 5, headY + 1, 10, 1);
      return;
    }
    case 'hardhat':
      rect(HARDHAT, x - 4, headY - 3, 8, 4);
      rect(HARDHAT_BRIM, x - 5, headY + 1, 10, 1);
      return;
    case 'short':
      rect(hair, x - 4, headY - 1, 8, 3);
      rect(hair, x - 4, headY + 2, 1, 2);
      rect(hair, x + 3, headY + 2, 1, 2);
      return;
    default: {
      const unreachable: never = look.hairStyle;
      throw new Error(`Unknown hair style ${String(unreachable)}`);
    }
  }
}

function drawTrolley(rect: Rect, trolley: Trolley, x: number, y: number, facing: 1 | -1): void {
  const tx = x + facing * 12;
  rect(TROLLEY, tx - 6, y - 2, 12, 1);
  rect(INK, tx - 5, y - 1, 2, 2);
  rect(INK, tx + 3, y - 1, 2, 2);
  rect(TROLLEY, x + facing * 5, y - 12, 1, 11);
  switch (trolley) {
    case 'parcel':
      rect('#c9955a', tx - 5, y - 12, 10, 10);
      rect('#a8743c', tx - 5, y - 12, 10, 1);
      rect('#e6c48a', tx - 1, y - 12, 2, 10);
      return;
    case 'strongbox':
      rect('#5c6877', tx - 5, y - 11, 10, 9);
      rect('#7d8a9a', tx - 5, y - 11, 10, 1);
      rect('#e2b84a', tx - 1, y - 8, 3, 3);
      rect('#8a6a1c', tx, y - 7, 1, 1);
      return;
    default: {
      const unreachable: never = trolley;
      throw new Error(`Unknown trolley ${String(unreachable)}`);
    }
  }
}

/* ----------------------------------------------------------------------- box */

/** A plain box, with just enough motion (a bob, feet, a flicker, a mouth) that a box stage still reads. */
function drawBox(painter: Painter, look: BoxLook, state: SpriteState, x: number, y: number): void {
  const t = state.time;
  if (state.pose === 'faint') {
    painter.rect(look.colour, x - Math.floor(look.h / 2), y - look.w, look.h, look.w);
    painter.rect(INK, x - 1, y - look.w - 2, 3, 1);
    return;
  }
  const walking = state.pose === 'walk';
  const typing = state.pose === 'type';
  const step = walking ? Math.floor(t * 9) % 2 : 0;
  const tap = typing ? Math.floor(t * (state.frantic ? 16 : 7)) % 2 : 0;
  const bob = step === 1 || (state.frantic && tap === 1) ? 1 : 0;
  const left = x - Math.floor(look.w / 2);
  const top = y - look.h - bob;
  painter.rect(look.colour, left, top, look.w, look.h);
  const eyeX = state.facing > 0 ? left + look.w - 2 : left + 1;
  painter.rect(INK, eyeX, top + 2, 1, state.pose === 'idle' && Math.sin(t * 0.4) > 0.6 ? 1 : 2);
  if (walking) painter.rect(INK, step === 0 ? left : left + look.w - 2, y - 1, 2, 1);
  if (typing) painter.rect(INK, tap === 0 ? left : left + look.w - 2, top - 2, 2, 1);
  if (state.talking && Math.floor(t * 6) % 2 === 1) painter.rect(MOUTH, x - 1, top + 4, 2, 1);
  if (state.trolley !== null) {
    drawTrolley((colour, rx, ry, w, h) => painter.rect(colour, rx, ry, w, h), state.trolley, x, y, state.facing);
  }
}
