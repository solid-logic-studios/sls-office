import type { MusicNote, MusicScore } from '../../contract/theme.ts';

/** The ambient hum's pitch (D3). The whole score is tuned from it, so the music never beats against the drone. */
export const D3_HZ = 147;
const STEPS_PER_BAR = 16;

/** Semitones above D3 for every pitch the score uses. */
const PITCH = {
  D3: 0,
  E3: 2,
  Fs3: 4,
  G3: 5,
  A3: 7,
  B3: 9,
  D4: 12,
  E4: 14,
  Fs4: 16,
  G4: 17,
  A4: 19,
  B4: 21,
  D5: 24,
  E5: 26,
  Fs5: 28,
} as const;
type Pitch = keyof typeof PITCH;

/** One note at `step` of `bar` (both from 0), held for `steps`. */
function n(bar: number, step: number, pitch: Pitch, steps: number): MusicNote {
  return { step: bar * STEPS_PER_BAR + step, steps, hz: D3_HZ * 2 ** (PITCH[pitch] / 12) };
}

/** A bar of bass: the root, a short pick-up on the fifth, the root again (a lazy dotted "boom, ba-boom"). */
function bassBar(bar: number, root: Pitch, fifth: Pitch): MusicNote[] {
  return [n(bar, 0, root, 6), n(bar, 6, fifth, 2), n(bar, 8, root, 6)];
}

/** A bar of broken chord: the four tones in turn, one every `every` steps (2 is quavers, 4 is crotchets). */
function arpBar(bar: number, tones: readonly [Pitch, Pitch, Pitch, Pitch], every = 2): MusicNote[] {
  return Array.from({ length: STEPS_PER_BAR / every }, (_, i) => n(bar, i * every, tones[i % 4] ?? tones[0], every));
}

/** Soft noise ticks on the given steps of a bar. Noise has no pitch, so the Hz is a placeholder. */
function hatBar(bar: number, steps: readonly number[]): MusicNote[] {
  return steps.map((step) => ({ step: bar * STEPS_PER_BAR + step, steps: 1, hz: D3_HZ }));
}

const BACKBEAT = [4, 12] as const;
const OFFBEATS = [2, 6, 10, 14] as const;

// Verse harmony, D | Bm7 | G | Asus4: the bass walks down F# E in the last half bar, back home to D.
const VERSE_BASS = [
  ...bassBar(0, 'D3', 'A3'),
  ...bassBar(1, 'B3', 'Fs3'),
  ...bassBar(2, 'G3', 'D3'),
  n(3, 0, 'A3', 6),
  n(3, 8, 'A3', 4),
  n(3, 12, 'Fs3', 2),
  n(3, 14, 'E3', 2),
];
// The Game Boy part: quiet staccato broken chords in quavers, keeping D on top or bottom throughout.
const VERSE_KEYS = [
  ...arpBar(0, ['D4', 'Fs4', 'A4', 'Fs4']),
  ...arpBar(1, ['D4', 'Fs4', 'B4', 'Fs4']),
  ...arpBar(2, ['D4', 'G4', 'B4', 'G4']),
  ...arpBar(3, ['E4', 'A4', 'D5', 'A4']),
];

/** The Office's music: lo-fi office radio as a Game Boy would play it. Warm, sparse, never in a hurry. */
export const MUSIC: MusicScore<'bass' | 'keys' | 'lead' | 'hat'> = {
  // A slow head-nod when the lab idles, a brisk walk when it is flat out. Never fast.
  bpm: { calm: 68, busy: 96 },
  stepsPerBeat: 4,
  stepsPerBar: STEPS_PER_BAR,
  volume: 1,
  voices: {
    // Round triangle bass an octave around the hum: the warmth of the piece.
    bass: { wave: 'triangle', volume: 0.05, attack: 0.012, release: 0.12, gate: 0.85 },
    // The only square wave, kept very quiet and short so it twinkles instead of buzzing.
    keys: { wave: 'square', volume: 0.012, attack: 0.008, release: 0.1, gate: 0.5 },
    // A soft triangle melody with a slow attack and a long tail, so phrases breathe.
    lead: { wave: 'triangle', volume: 0.03, attack: 0.025, release: 0.3, gate: 0.9 },
    // A tiny noise tick, the same family as the keyboard clatter: time-keeping, not drums.
    hat: { wave: 'noise', volume: 0.015, attack: 0.002, release: 0.03, gate: 0.05 },
  },
  sections: [
    // 0, Verse (call): the tune rises D-wards and hangs on A, an open question. Ticks on the backbeat.
    {
      bars: 4,
      parts: {
        bass: VERSE_BASS,
        keys: VERSE_KEYS,
        lead: [
          n(0, 4, 'A4', 2),
          n(0, 6, 'D5', 2),
          n(0, 8, 'Fs5', 6),
          n(1, 4, 'E5', 2),
          n(1, 6, 'D5', 2),
          n(1, 8, 'B4', 6),
          n(2, 4, 'B4', 2),
          n(2, 6, 'D5', 2),
          n(2, 8, 'E5', 4),
          n(2, 14, 'D5', 2),
          n(3, 0, 'A4', 10),
        ],
        hat: [0, 1, 2, 3].flatMap((bar) => hatBar(bar, BACKBEAT)),
      },
    },
    // 1, Verse (answer): the same harmony, the tune turned upside down, settling on D ready for home.
    {
      bars: 4,
      parts: {
        bass: VERSE_BASS,
        keys: VERSE_KEYS,
        lead: [
          n(0, 4, 'Fs5', 2),
          n(0, 6, 'E5', 2),
          n(0, 8, 'D5', 6),
          n(1, 4, 'B4', 2),
          n(1, 6, 'D5', 2),
          n(1, 8, 'Fs5', 6),
          n(2, 4, 'E5', 2),
          n(2, 6, 'D5', 2),
          n(2, 8, 'B4', 6),
          n(3, 4, 'A4', 2),
          n(3, 6, 'B4', 2),
          n(3, 8, 'D5', 6),
        ],
        hat: [0, 1, 2, 3].flatMap((bar) => hatBar(bar, bar === 3 ? [4, 12, 14] : BACKBEAT)),
      },
    },
    // 2, Bridge, G | D/F# | Em7 | Asus4: a lift away from home. Long held notes, ticks on the off-beats.
    {
      bars: 4,
      parts: {
        bass: [
          ...bassBar(0, 'G3', 'D3'),
          ...bassBar(1, 'Fs3', 'A3'),
          ...bassBar(2, 'E3', 'B3'),
          n(3, 0, 'A3', 6),
          n(3, 8, 'A3', 4),
          n(3, 12, 'Fs3', 2),
          n(3, 14, 'E3', 2),
        ],
        keys: [
          ...arpBar(0, ['D4', 'G4', 'B4', 'G4']),
          ...arpBar(1, ['D4', 'Fs4', 'A4', 'Fs4']),
          ...arpBar(2, ['E4', 'G4', 'B4', 'G4']),
          ...arpBar(3, ['E4', 'A4', 'D5', 'A4']),
        ],
        lead: [
          n(0, 0, 'B4', 6),
          n(0, 8, 'D5', 4),
          n(1, 0, 'A4', 6),
          n(1, 8, 'Fs5', 4),
          n(2, 0, 'B4', 6),
          n(2, 8, 'E5', 4),
          n(3, 0, 'E5', 4),
          n(3, 4, 'D5', 4),
          n(3, 8, 'A4', 6),
        ],
        hat: [0, 1, 2, 3].flatMap((bar) => hatBar(bar, OFFBEATS)),
      },
    },
    // 3, Breather, D | G | D | Asus4: no ticks, held bass, chords in slow crotchets, one late phrase.
    // The rest that stops the loop grating over hours.
    {
      bars: 4,
      parts: {
        bass: [n(0, 0, 'D3', 12), n(1, 0, 'G3', 12), n(2, 0, 'D3', 12), n(3, 0, 'A3', 12)],
        keys: [
          ...arpBar(0, ['D4', 'Fs4', 'A4', 'Fs4'], 4),
          ...arpBar(1, ['D4', 'G4', 'B4', 'G4'], 4),
          ...arpBar(2, ['D4', 'Fs4', 'A4', 'Fs4'], 4),
          ...arpBar(3, ['E4', 'A4', 'D5', 'A4'], 4),
        ],
        lead: [n(2, 8, 'Fs4', 4), n(2, 12, 'A4', 4), n(3, 0, 'A4', 12)],
      },
    },
  ],
  // Call, answer, bridge, answer, breather, call, bridge, answer: 32 bars, and the answer leads back to the call.
  order: [0, 1, 2, 1, 3, 0, 2, 1],
};
