import type { Soundscape, SynthNote } from '../../contract/theme.ts';

/** One half of the two-tone: a square wave that slides from `from` to `to`. */
function beep(from: number, to: number, gap = 0.04): SynthNote {
  return { wave: 'square', startHz: from, endHz: to, attack: 0.01, sustain: 0.09, decay: 0.05, volume: 0.35, gap };
}

/** One soft, rounded note at a steady pitch. */
function note(wave: SynthNote['wave'], hz: number, sustain: number, volume: number, gap = 0.06): SynthNote {
  return { wave, startHz: hz, endHz: hz, attack: 0.02, sustain, decay: 0.12, volume, gap };
}

/** A pitch slide with its own envelope: the building block of the stage effects. */
function glide(
  wave: SynthNote['wave'],
  from: number,
  to: number,
  [attack, sustain, decay]: readonly [number, number, number],
  volume: number,
  gap = 0,
): SynthNote {
  return { wave, startHz: from, endHz: to, attack, sustain, decay, volume, gap };
}

/** A breath of white noise; noise ignores pitch, so the Hz is a placeholder. */
function hiss(envelope: readonly [number, number, number], volume: number, gap = 0): SynthNote {
  return glide('noise', 440, 440, envelope, volume, gap);
}

/** A tiny mechanical click, about 0.03 s. */
function tick(volume: number, gap: number): SynthNote {
  return hiss([0.002, 0.004, 0.025], volume, gap);
}

/** The Office's sounds. The Alarm: three rising and falling pairs, about 1.2 s, chiptune but not shrill. */
export const SOUNDSCAPE: Soundscape = {
  effects: {
    // Gentle anticipation, about 0.33 s: two triangle steps up, then a slide that stops short of home.
    deployStarted: {
      notes: [
        glide('triangle', 294, 294, [0.01, 0.04, 0.04], 0.16, 0.02),
        glide('triangle', 330, 330, [0.01, 0.04, 0.04], 0.16, 0.02),
        glide('triangle', 330, 440, [0.01, 0.06, 0.07], 0.18),
      ],
    },
    // The answer to deployStarted, about 0.35 s: a soft rising fourth that lands on the home note and rings.
    deployHealthy: {
      notes: [
        glide('triangle', 440, 440, [0.01, 0.05, 0.05], 0.18, 0.02),
        glide('triangle', 587, 587, [0.01, 0.08, 0.14], 0.2),
      ],
    },
    // A quick airy swish, about 0.2 s: a sheet of paper cutting the air, swelling then gone.
    paper: { notes: [hiss([0.09, 0.02, 0.09], 0.09)] },
    // A polite knock-knock, about 0.25 s: two low woody thuds, each dropping in pitch.
    visitor: {
      notes: [
        glide('triangle', 260, 190, [0.003, 0.012, 0.07], 0.22, 0.08),
        glide('triangle', 260, 190, [0.003, 0.012, 0.07], 0.2),
      ],
    },
    // A murmured "how's it going?", about 0.33 s: a short flat syllable, then one that lifts like a question.
    checkIn: {
      notes: [
        glide('sine', 370, 370, [0.015, 0.04, 0.04], 0.16, 0.03),
        glide('sine', 415, 554, [0.015, 0.09, 0.1], 0.18),
      ],
    },
    // A bright little pop-in, about 0.2 s: a quiet square blip that jumps an octave, like a coin.
    workloadAdded: {
      notes: [
        glide('square', 330, 330, [0.005, 0.03, 0.02], 0.09, 0.01),
        glide('square', 660, 660, [0.005, 0.06, 0.07], 0.1),
      ],
    },
    // A soft exit, about 0.36 s: one sine sighing down an octave as it fades.
    workloadRemoved: { notes: [glide('sine', 494, 247, [0.02, 0.1, 0.24], 0.16)] },
    // A drive spinning up, about 0.42 s: two small ratchet clicks, then a low hum that climbs.
    backupStarted: {
      notes: [tick(0.1, 0.05), tick(0.1, 0.05), glide('triangle', 175, 262, [0.03, 0.1, 0.12], 0.2)],
    },
    // The job put away, about 0.42 s: two low steady notes settling upward, then the latch clicks shut.
    backupFinished: {
      notes: [
        glide('triangle', 196, 196, [0.01, 0.05, 0.05], 0.18, 0.02),
        glide('triangle', 262, 262, [0.01, 0.07, 0.11], 0.2, 0.03),
        tick(0.1, 0),
      ],
    },
  },
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
