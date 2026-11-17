import type { PiperVoice, Soundscape, SynthNote, Voice } from '../../contract/theme.ts';

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

/** The one Piper model every Office Voice is cast from: 904 LibriTTS speakers, so each Part gets its own. */
const MODEL = 'en_US-libritts-high';

/**
 * A Voice cast from a speaker of the model. `rate` paces the clip; `pitch` only steers the `speechSynthesis`
 * fallback (Piper cannot shift pitch, so the speaker is the pitch). `id` is its name and keys its clips.
 */
function voice(id: string, speaker: number, rate: number, pitch: number): Voice {
  const piper: PiperVoice = { model: MODEL, speaker };
  return { id, pitch, rate, lang: 'en-AU', piper };
}

/**
 * Words to say instead of a bubble line, where reading it as lower case would come out wrong: symbols,
 * initialisms, digits, a trailing ellipsis or a slang spelling an American voice would mangle (#30).
 */
const SPOKEN: Readonly<Record<string, string>> = {
  '!!': 'argh!',
  'CPU IS COOKED': 'c p u is cooked',
  '200 OK': 'two hundred, okay',
  LGTM: 'looks good to me',
  'ONE SEC...': 'one sec',
  'SHHH.': 'shush',
  'FSYNC IS ON': 'f sync is on',
  'QUIET TODAY, EH': 'quiet today, ay',
  'HEARD ABOUT THE NVME?': 'heard about the n v m e?',
  'HEALTH CHECK...': 'health check',
  'OLD ONE OUT. CYA!': 'old one out. see ya!',
  'SENT HOME...': 'sent home',
  '02:30. BACKUP TIME.': 'two thirty. backup time.',
  'SAFE IN R2': 'safe in r two',
  'SELECT * FROM SCORES': 'select star from scores',
  'ONE QUERY, TA': 'one query, tah',
  'WP_POSTS PLEASE': 'w p posts please',
  'NEED WP_OPTIONS': 'need w p options',
  'GET /': 'get slash',
  'GET /HEALTH': 'get slash health',
  'POST /SCORES': 'post slash scores',
  'GET /WP-LOGIN': 'get slash w p login',
  '#ALERTS IS RINGING!': 'the alerts channel is ringing!',
  'THAT NVME HAS UNTIL JANUARY': 'that n v m e has until january',
  'DAD JOKE LOADING...': 'dad joke loading',
  'HOWZAT! GREEN BUILD': 'how zat! green build',
  'CHUCK IT ON STAGING, EH': 'chuck it on staging, ay',
  'BIT OF A DRAMA, EH': 'bit of a drama, ay',
  'CRIKEY, #ALERTS IS GOING OFF': 'crikey, the alerts channel is going off',
};

/** The Office's sounds. The Alarm: three rising and falling pairs, about 1.2 s, chiptune but not shrill. */
export const SOUNDSCAPE: Soundscape = {
  voices: {
    // The visitors' voice (an HTTP request): a clear, neutral man, an outsider among the workers.
    default: voice('office-default', 776, 1.1, 1),
    parts: {
      // The desk workers: a plain, even woman, steady and a touch brisk.
      worker: voice('office-worker', 644, 1.05, 1),
      // The CI pods: a young, bright woman, quick and high, in and out before you notice.
      pod: voice('office-pod', 702, 1.3, 1.5),
      // The greeter at the gateway: a warm, bright woman, unhurried.
      greeter: voice('office-greeter', 354, 1, 1.3),
      // The guard: a thick, dark, mature man, slow and low.
      guard: voice('office-guard', 573, 0.8, 0.6),
      // The checker: a crisp, sharp woman, reading the list out like a verdict.
      checker: voice('office-checker', 564, 1.15, 0.95),
      // The keeper of the vault: a calm, soft, deep man, quiet and careful.
      keeper: voice('office-keeper', 480, 0.85, 0.75),
      // The courier: a light, lively man, fast and always on the way somewhere else.
      courier: voice('office-courier', 350, 1.25, 1.2),
      // The wrangler: a gruff, middle-aged man, unhurried and used to herding things.
      wrangler: voice('office-wrangler', 523, 0.9, 0.85),
      // Any founder not named below: a plain, pleasant man.
      founder: voice('office-founder', 27, 1, 1),
    },
    founders: {
      // Paul: clear, warm and measured, a little lower; the dad-joke delivery.
      paul: voice('founder-paul', 174, 0.95, 0.85),
      // Dhruv: brighter and livelier, the easy, cheerful one.
      dhruv: voice('founder-dhruv', 565, 1.05, 1.1),
    },
  },
  spoken: SPOKEN,
  // Runs all day under everything, so it is barely there: felt more than heard.
  ambient: {
    // A dark, soft wash of air conditioning, like the next room over.
    room: { volume: 0.025, lowpassHz: 420 },
    // A low server drone that swells a little as the lab works harder.
    hum: { wave: 'triangle', hz: 147, idle: 0.012, busy: 0.05 },
    // Soft keyboard ticks: a lazy tap now and then when calm, a rattle when the workers are swamped.
    clatter: { key: { notes: [tick(0.05, 0)] }, calm: 0.4, frantic: 7 },
  },
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
