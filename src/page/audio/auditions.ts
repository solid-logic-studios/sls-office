import type { EffectName, Theme, Voice } from '../../contract/theme.ts';
import { voiceLines } from './voice-lines.ts';

/** Something to try from the `?sim` Sound panel: a cue, a stage effect or a sample line in one Voice. */
export type Audition =
  | { kind: 'cue'; cue: 'alarm' | 'reminder' | 'allClear' }
  | { kind: 'effect'; effect: EffectName }
  | { kind: 'voice'; voice: Voice; text: string };

const CUE_LABELS = { alarm: 'Alarm', reminder: 'Reminder', allClear: 'All-clear' } as const;

/** Every effect in the order the Theme contract lists them, so the panel does not shuffle between Themes. */
const EFFECT_ORDER: readonly EffectName[] = [
  'deployStarted',
  'deployHealthy',
  'paper',
  'visitor',
  'checkIn',
  'workloadAdded',
  'workloadRemoved',
  'backupStarted',
  'backupFinished',
];

/** Each distinct Voice in the Soundscape, the default first, then the Parts', then the founders'. */
function distinctVoices(theme: Theme): Voice[] {
  const voices = theme.soundscape?.voices;
  if (voices === undefined) return [];
  const all = [voices.default, ...Object.values(voices.parts ?? {}), ...Object.values(voices.founders ?? {})];
  return all.filter((voice, index) => all.findIndex((other) => other.id === voice.id) === index);
}

/**
 * Everything the Theme's Soundscape can sound, for the Sound panel: the three cues, each effect it has, and
 * one sample line per distinct Voice (the first line that Voice can say, as spoken). A Voice with no line
 * is left out, and a Theme without a Soundscape has nothing to try.
 */
export function auditions(theme: Theme): Audition[] {
  const { soundscape } = theme;
  if (soundscape === undefined) return [];
  const cues = (['alarm', 'reminder', 'allClear'] as const).map((cue): Audition => ({ kind: 'cue', cue }));
  const effects = EFFECT_ORDER.filter((effect) => soundscape.effects?.[effect] !== undefined).map(
    (effect): Audition => ({ kind: 'effect', effect }),
  );
  const lines = voiceLines(theme);
  const voices = distinctVoices(theme).flatMap((voice): Audition[] => {
    const line = lines.find((candidate) => candidate.voice.id === voice.id);
    return line === undefined ? [] : [{ kind: 'voice', voice, text: line.text }];
  });
  return [...cues, ...effects, ...voices];
}

/** "deployStarted" as "Deploy started". */
function words(effect: EffectName): string {
  const spaced = effect.replace(/([A-Z])/g, ' $1').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The panel button's text: "Alarm", "Deploy started", "Voice: office-guard". */
export function auditionLabel(audition: Audition): string {
  switch (audition.kind) {
    case 'cue':
      return CUE_LABELS[audition.cue];
    case 'effect':
      return words(audition.effect);
    case 'voice':
      return `Voice: ${audition.voice.id}`;
  }
}
