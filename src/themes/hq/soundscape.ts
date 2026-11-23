import type { Soundscape, SynthNote, SynthSound, Voice, Voices, Wave } from '../../contract/theme.ts';
import { D3_HZ } from '../office/music.ts';
import { SOUNDSCAPE as OFFICE } from '../office/soundscape.ts';
import { FOUNDERS } from './founders.ts';
import { LINES } from './lines.ts';
import { VOCABULARY } from './vocabulary.ts';

/*
 * The HQ's sounds (docs/design/hq-theme.md, section 9). Data only; the Soundboard plays it. It stays soft:
 * it runs all day. The Voices are the Office's, so a shared line needs no new clip; JARVIS is the one new Voice.
 */

type Envelope = readonly [attack: number, sustain: number, decay: number];

/** A pitch slide with its own envelope: the building block of the stage effects. */
function glide(
  wave: Wave,
  from: number,
  to: number,
  [attack, sustain, decay]: Envelope,
  volume: number,
  gap = 0,
): SynthNote {
  return { wave, startHz: from, endHz: to, attack, sustain, decay, volume, gap };
}

/** One steady note. */
const tone = (wave: Wave, hz: number, envelope: Envelope, volume: number, gap = 0): SynthNote =>
  glide(wave, hz, hz, envelope, volume, gap);

/** A breath of white noise; noise ignores pitch, so the Hz is a placeholder. */
const hiss = (envelope: Envelope, volume: number, gap = 0): SynthNote =>
  glide('noise', 440, 440, envelope, volume, gap);

/** A tiny mechanical click, about 0.03 s. */
const click = (volume: number, gap: number): SynthNote => hiss([0.002, 0.004, 0.025], volume, gap);

/** A sound with each note's wave swapped as `swaps` says: the Office's easter eggs, in a slightly different timbre. */
function retimbre(sound: SynthSound | undefined, swaps: Partial<Record<Wave, Wave>>): SynthSound {
  if (sound === undefined) throw new Error('the Office dropped an easter egg sound');
  return { notes: sound.notes.map((note) => ({ ...note, wave: swaps[note.wave] ?? note.wave })) };
}

if (OFFICE.voices === undefined || OFFICE.spoken === undefined) {
  throw new Error('the Office soundscape lost its voices or spoken words');
}
const OFFICE_VOICES: Voices = OFFICE.voices;

/**
 * JARVIS: the calmest, most even speaker in the model, a touch slower and lower than the founders.
 * The speaker is a first pick, to be settled by ear with the audition tool.
 */
const JARVIS_VOICE: Voice = {
  id: 'founder-jarvis',
  pitch: 0.9,
  rate: 0.95,
  lang: 'en-AU',
  piper: { model: 'en_US-libritts-high', speaker: 118 },
};

/**
 * Words to say instead of a new HQ bubble line, where reading it as lower case would come out wrong: symbols,
 * initialisms, digits, a trailing ellipsis or a slang spelling. The Office's overrides carry over (the lines
 * the two Themes share), so only the HQ's own are listed here.
 */
export const HQ_SPOKEN: Readonly<Record<string, string>> = {
  'HANGAR TO OPS: INBOUND': 'hangar to ops, inbound',
  'MY WATCH IS DONE. CYA!': 'my watch is done. see ya!',
  'VITALS CHECK...': 'vitals check',
  'BACK TO THE HANGAR...': 'back to the hangar',
  '02:30. JET RUN.': 'two thirty. jet run.',
  'SAFE IN THE R2 BUNKER': 'safe in the r two bunker',
  'ONE RECORD, TA': 'one record, tah',
  'ONE-TWO!': 'one, two!',
  '#ALERTS IS RINGING!': 'the alerts channel is ringing!',
};

/** Every bubble text the HQ can say: its line bank and its founders' lines. */
const SAYABLE: ReadonlySet<string> = new Set([
  ...Object.values(LINES.mood).flat(),
  ...Object.values(LINES.part).flat(),
  ...Object.values(LINES.breakSpot).flat(),
  ...Object.values(LINES.cue).flat(),
  ...FOUNDERS.flatMap((founder) => [...founder.lines.idle, ...founder.lines.checkIn, ...founder.lines.alarm]),
]);

/** The Office's overrides for the lines the HQ shares with it; the rest would be orphans here. */
function sharedOfficeSpoken(spoken: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(spoken).filter(([text]) => SAYABLE.has(text)));
}

const KLAXON_WHOOP: Omit<SynthNote, 'gap'> = {
  wave: 'sawtooth',
  startHz: 600,
  endHz: 300,
  attack: 0.03,
  sustain: 0.22,
  decay: 0.1,
  volume: 0.2,
};

export const SOUNDSCAPE: Soundscape = {
  voices: {
    ...OFFICE_VOICES,
    founders: { ...OFFICE_VOICES.founders, jarvis: JARVIS_VOICE },
  },
  spoken: { ...sharedOfficeSpoken(OFFICE.spoken), ...HQ_SPOKEN },
  vocabulary: VOCABULARY,
  ambient: {
    // Darker and lower than the Office: the next deck down, through the hull.
    room: { volume: 0.025, lowpassHz: 300 },
    // The core: a sine on the Office's D, so the two Themes' music stays in key. It swells with load.
    hum: { wave: 'sine', hz: D3_HZ, idle: 0.018, busy: 0.055 },
    // Not keys but console blips: a very short, high sine tick.
    clatter: { key: { notes: [tone('sine', 2400, [0.002, 0.006, 0.03], 0.035)] }, calm: 0.5, frantic: 7 },
  },
  effects: {
    // A hangar servo, about 0.5 s: a short swell of air under a rising triangle.
    deployStarted: {
      notes: [hiss([0.12, 0.06, 0.08], 0.06, 0.02), glide('triangle', 160, 320, [0.04, 0.12, 0.1], 0.16)],
    },
    // A suit locking on, about 0.4 s: two clicks, then a bright fifth.
    deployHealthy: {
      notes: [
        click(0.12, 0.05),
        click(0.12, 0.05),
        tone('triangle', 587, [0.01, 0.05, 0.05], 0.16, 0.02),
        tone('triangle', 880, [0.01, 0.08, 0.16], 0.16),
      ],
    },
    // A soft whoosh, about 0.25 s.
    paper: { notes: [hiss([0.1, 0.03, 0.12], 0.08)] },
    // The gate's two-note chime, about 0.4 s.
    visitor: {
      notes: [tone('sine', 660, [0.01, 0.06, 0.12], 0.16, 0.02), tone('sine', 880, [0.01, 0.08, 0.16], 0.16)],
    },
    // A comm chirp, about 0.1 s.
    checkIn: { notes: [glide('sine', 1200, 1800, [0.005, 0.04, 0.05], 0.1)] },
    // A blip up and a blip down.
    workloadAdded: { notes: [glide('sine', 440, 880, [0.005, 0.04, 0.06], 0.1)] },
    workloadRemoved: { notes: [glide('sine', 880, 440, [0.005, 0.05, 0.1], 0.1)] },
    // The jet spooling up, about 0.8 s: air rising under a sine glide from 200 to 600 Hz.
    backupStarted: {
      notes: [hiss([0.25, 0.1, 0.05], 0.06, 0.02), glide('sine', 200, 600, [0.05, 0.25, 0.15], 0.14)],
    },
    // A distant thump, then a chime.
    backupFinished: {
      notes: [glide('sine', 80, 50, [0.005, 0.05, 0.2], 0.25, 0.05), tone('triangle', 880, [0.01, 0.08, 0.3], 0.12)],
    },
    snore: retimbre(OFFICE.effects?.snore, { triangle: 'sine' }),
    streak: retimbre(OFFICE.effects?.streak, { square: 'triangle' }),
    smoko: retimbre(OFFICE.effects?.smoko, { sine: 'triangle' }),
    hatTrick: retimbre(OFFICE.effects?.hatTrick, { square: 'triangle' }),
  },
  // A klaxon, not a siren: three downward whoops, about 1.3 s in all.
  alarm: {
    notes: [
      { ...KLAXON_WHOOP, gap: 0.12 },
      { ...KLAXON_WHOOP, gap: 0.12 },
      { ...KLAXON_WHOOP, gap: 0 },
    ],
  },
  // One soft sonar ping.
  reminder: { notes: [tone('sine', 880, [0.005, 0.03, 0.5], 0.15)] },
  // Power restored, about 0.6 s: a rising fifth, then the octave.
  allClear: {
    notes: [
      tone('triangle', 294, [0.01, 0.08, 0.1], 0.3, 0.03),
      tone('triangle', 440, [0.01, 0.08, 0.1], 0.3, 0.03),
      tone('triangle', 587, [0.01, 0.18, 0.2], 0.3),
    ],
  },
};
