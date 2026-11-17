import type { Cue, Founder, Part, Theme, Vocabulary, Voice, Voices } from '../../contract/theme.ts';
import { clipKey } from './clip-key.ts';
import { spokenText, voiceFor } from './voice-casting.ts';

/** One line a Voice can say: what the image build renders and the page looks up. */
export interface VoiceLine {
  /** The clip's name: `clipKey(voice.id, text)`. */
  key: string;
  voice: Voice;
  /** As spoken: lower case, or the Theme's `spoken` override. */
  text: string;
}

/** Who says a Cue: a Part, or a `'visitor'`, a passer-by with no Part who gets the default Voice. */
type Speaker = Part | 'visitor';

/** Every Part a deploy's target or newcomer can be: whatever the Theme casts a workload as. */
const DEPLOYED: readonly Speaker[] = ['worker', 'pod', 'greeter', 'guard', 'checker'];
/** Every Part that can pass out and come round again: all but the founders, who are not in the Snapshot. */
const CAN_FAINT: readonly Speaker[] = ['worker', 'pod', 'greeter', 'guard', 'checker', 'keeper', 'courier', 'wrangler'];

/**
 * Who can say each Cue, read from the Engine's `sayCue` call sites (scenes, characters, banter and
 * visitor). A Cue said by "whoever is deployed" or "whoever recovers" lists every Part that can be.
 */
export const CUE_SPEAKERS: Readonly<Record<Cue, readonly Speaker[]>> = {
  // The courier wheels the newcomer in (DeployScene.enter).
  delivery: ['courier'],
  // The newcomer, cast as whatever the deployed workload is (DeployScene.act).
  'new-arrival': DEPLOYED,
  // The checker runs the health check (DeployScene.act).
  'health-check': ['checker'],
  // The checker gives the verdict (DeployScene.resolve).
  healthy: ['checker'],
  unhealthy: ['checker'],
  // The deployed workload's old character, as the newcomer takes over (DeployScene.resolve).
  'old-one-out': DEPLOYED,
  // The rejected newcomer, on a rolled-back deploy (DeployScene.resolve).
  'sent-home': DEPLOYED,
  // The old character, still on duty after a rollback (DeployScene.resolve).
  'still-serving': DEPLOYED,
  // The keeper runs the vault (VaultRun).
  'backup-start': ['keeper'],
  'backup-locked': ['keeper'],
  'backup-safe': ['keeper'],
  'backup-failed': ['keeper'],
  // The wrangler minds the pods (SceneTriggers.endSnapshot, PodRun.resolve).
  'pods-up': ['wrangler'],
  'pod-done': ['wrangler'],
  // Whoever was OOM killed and comes round again (Character.recover).
  recovered: CAN_FAINT,
  // A site worker sends the keeper a query, and the keeper answers (QueryRun).
  query: ['worker'],
  'query-answer': ['keeper'],
  // A passer-by on the way to a worker (Visitor.behave).
  visitor: ['visitor'],
  // The greeter, as a visitor stops by (Visitor.greet).
  greet: ['greeter'],
  // A site worker, when a founder checks in (DeskWorker.checkedIn; founders only visit workers).
  'check-in-reply': ['worker'],
  'check-in-reply-busy': ['worker'],
  // The greeter's idle chatter while a critical finding is open (DeskWorker.chatter).
  alarm: ['greeter'],
};

/** A speaker no Voice is listed under: `voiceFor` falls through to the Part's Voice, then the default. */
const NO_ONE = '';

function voiceOf(voices: Voices, speaker: Speaker): Voice {
  return voiceFor(voices, speaker === 'visitor' ? undefined : { id: NO_ONE, part: speaker });
}

function founderVoice(voices: Voices, founder: Founder): Voice {
  return voiceFor(voices, { id: founder.id, part: 'founder' });
}

/** Every string an Announcement can be stitched from. */
function vocabularyWords({ numbers, parts, moods, phrases }: Vocabulary): string[] {
  return [...numbers, ...Object.values(parts), ...Object.values(moods), ...Object.values(phrases)];
}

/**
 * Every line any character can say in `theme`, with only the Voices that can say it: the line banks by
 * who draws from them, each founder's own lines in their own Voice. Unique by clip key, sorted by key,
 * so the list is stable for unchanged input. Includes Voices with no Piper voice; the build filters.
 */
export function voiceLines(theme: Theme): VoiceLine[] {
  const voices = theme.soundscape?.voices;
  if (voices === undefined) return [];
  const spoken = theme.soundscape?.spoken;
  const found = new Map<string, VoiceLine>();
  const add = (voice: Voice, lines: readonly string[] | undefined): void => {
    for (const line of lines ?? []) {
      const text = spokenText(line, spoken);
      const key = clipKey(voice.id, text);
      const existing = found.get(key);
      if (existing === undefined) found.set(key, { key, voice, text });
      else if (existing.text !== text) throw new Error(`Clip key ${key} is shared by "${existing.text}" and "${text}"`);
    }
  };

  const { lines } = theme;
  const worker = voiceOf(voices, 'worker');
  for (const bank of Object.values(lines.mood)) add(worker, bank);
  for (const bank of Object.values(lines.breakSpot)) add(worker, bank);
  for (const [part, bank] of Object.entries(lines.part)) add(voiceOf(voices, part as Part), bank);
  for (const [cue, speakers] of Object.entries(CUE_SPEAKERS) as [Cue, readonly Speaker[]][]) {
    for (const speaker of speakers) add(voiceOf(voices, speaker), lines.cue[cue]);
  }
  for (const founder of theme.founders) {
    const voice = founderVoice(voices, founder);
    add(voice, founder.lines.idle);
    add(voice, founder.lines.checkIn);
    add(voice, founder.lines.alarm);
  }
  // An Announcement can be made in any founder's Voice, or the default one when the Theme has no founders.
  const announcers =
    theme.founders.length === 0 ? [voices.default] : theme.founders.map((f) => founderVoice(voices, f));
  const { vocabulary } = theme.soundscape ?? {};
  for (const voice of announcers) add(voice, vocabulary === undefined ? undefined : vocabularyWords(vocabulary));
  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
