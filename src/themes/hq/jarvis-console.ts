import type { Painter } from '../../contract/painter.ts';
import type { DecorFn, Rect, StageView } from '../../contract/theme.ts';
import { JARVIS_LINE_MAX } from './jarvis-lines.ts';
import { jarvisSpeech, type Speech } from './jarvis-speech.ts';
import { paintOrb, type OrbSpec } from './orb.ts';
import { ALARM, AMBER, HULL, INK, LAMP, STEEL, UNLIT } from './palette.ts';
import { wave } from './kit.ts';

/**
 * The JARVIS console: the readout JARVIS types its lines on, the projector on the deck and the orb
 * floating between them. A Theme places it with a `ConsoleSpec`, so the wide HQ and the phone Spire
 * share the art.
 */
export interface ConsoleSpec {
  /** The readout strip, at least `READOUT_MIN_WIDTH` wide and 12 px tall. */
  readout: Rect;
  orb: OrbSpec;
  /** The projector under the orb. */
  pedestal: Rect;
}

const PROMPT = '> ';
const ADVANCE = 6;
/** From the strip's edge to the text: the 1 px frame and a 2 px gap. */
const PAD = 3;
const CURSOR = { w: 4, h: 7 } as const;

/** The least readout width that fits the prompt, the longest line, the cursor after it and the frame. */
export const READOUT_MIN_WIDTH = PAD + (PROMPT.length + JARVIS_LINE_MAX) * ADVANCE + CURSOR.w + 1;

/** The readout: a dark strip, the prompt, the line as typed so far and a block cursor. */
function paintReadout(painter: Painter, { x, y, w, h }: Rect, speech: Speech, now: number): void {
  const alarm = speech.state === 'alarm';
  const ink = alarm ? ALARM.light : AMBER.glow;
  painter.rect(alarm ? ALARM.dark : STEEL.dark, x, y, w, h);
  painter.rect(INK, x + 1, y + 1, w - 2, h - 2);
  const typed = PROMPT + speech.text.slice(0, speech.shown);
  const baseline = y + h - 2;
  painter.text(typed, x + PAD, baseline, ink);
  // The cursor is solid while typing and blinks once the line is out.
  if (speech.speaking || Math.floor(now * 2) % 2 === 0) {
    painter.rect(ink, x + PAD + typed.length * ADVANCE, baseline - CURSOR.h, CURSOR.w, CURSOR.h);
  }
}

/** The projector: a plate on a plinth, an emitter that glows with the orb and three status lamps. */
function paintPedestal(painter: Painter, { x, y, w, h }: Rect, stage: StageView, speech: Speech): void {
  const mid = x + w / 2;
  const alarm = speech.state === 'alarm';
  painter.rect(HULL.dark, x + 2, y + 4, w - 4, h - 4);
  painter.rect(HULL.light, x + 3, y + 4, w - 6, h - 5);
  painter.rect(STEEL.base, x, y + 2, w, 2);
  painter.rect(STEEL.shine, x, y + 2, w, 1);
  painter.rect(alarm ? ALARM.base : AMBER.glow, mid - 4, y, 8, 2);
  painter.rect(alarm ? ALARM.white : AMBER.white, mid - 2, y, 4, 1);
  const { crit, warn } = stage.findings;
  const lamps = [
    crit > 0 ? ALARM.base : LAMP.ok,
    warn > 0 ? LAMP.warn : UNLIT,
    wave(stage.now, 1.1) > 0.5 ? AMBER.glow : UNLIT,
  ];
  lamps.forEach((colour, i) => painter.rect(colour, mid - 5 + i * 4, y + 7, 2, 2));
}

/** The light the projector throws up at the orb: a faint cone, widening as it rises. */
function paintCone(painter: Painter, { orb, pedestal }: ConsoleSpec, speech: Speech, now: number): void {
  const top = orb.cy + orb.r + 1;
  const colour = speech.state === 'alarm' ? ALARM.base : AMBER.glow;
  const alpha = 0.1 + 0.06 * wave(now, 2.2);
  painter.withAlpha(alpha, () => {
    for (let y = pedestal.y - 1; y >= top; y--) {
      const half = 4 + (pedestal.y - 1 - y);
      painter.rect(colour, orb.cx - half, y, half * 2 + 1, 1);
    }
  });
}

export function jarvisConsole(spec: ConsoleSpec): DecorFn {
  return (painter, stage) => {
    const speech = jarvisSpeech(stage);
    paintReadout(painter, spec.readout, speech, stage.now);
    paintPedestal(painter, spec.pedestal, stage, speech);
    paintCone(painter, spec, speech, stage.now);
    paintOrb(painter, stage, spec.orb);
  };
}
