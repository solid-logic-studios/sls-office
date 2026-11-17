import type { Soundscape, SynthNote } from '../../contract/theme.ts';

/** One half of the two-tone: a square wave that slides from `from` to `to`. */
function beep(from: number, to: number, gap = 0.04): SynthNote {
  return { wave: 'square', startHz: from, endHz: to, attack: 0.01, sustain: 0.09, decay: 0.05, volume: 0.35, gap };
}

/** One soft, rounded note at a steady pitch. */
function note(wave: SynthNote['wave'], hz: number, sustain: number, volume: number, gap = 0.06): SynthNote {
  return { wave, startHz: hz, endHz: hz, attack: 0.02, sustain, decay: 0.12, volume, gap };
}

/** The Office's sounds. The Alarm: three rising and falling pairs, about 1.2 s, chiptune but not shrill. */
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
  // Two quiet sine notes, about 0.5 s: a nudge, not a shout.
  reminder: { notes: [note('sine', 440, 0.12, 0.2), note('sine', 392, 0.14, 0.18, 0)] },
  // A cheerful rising C major arpeggio, about 0.55 s.
  allClear: {
    notes: [note('triangle', 523, 0.08, 0.35), note('triangle', 659, 0.08, 0.35), note('triangle', 784, 0.16, 0.35, 0)],
  },
};
