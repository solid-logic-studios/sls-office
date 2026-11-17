import type { Soundscape, SynthNote } from '../../contract/theme.ts';

/** One half of the two-tone: a square wave that slides from `from` to `to`. */
function beep(from: number, to: number, gap = 0.04): SynthNote {
  return { wave: 'square', startHz: from, endHz: to, attack: 0.01, sustain: 0.09, decay: 0.05, volume: 0.35, gap };
}

/** The Office's Alarm: three rising and falling pairs, about 1.2 s, chiptune but not shrill. */
export const SOUNDSCAPE: Soundscape = {
  alarm: {
    notes: [
      beep(520, 780),
      beep(780, 520, 0.1),
      beep(520, 780),
      beep(780, 520, 0.1),
      beep(520, 780),
      beep(780, 520, 0),
    ],
  },
};
