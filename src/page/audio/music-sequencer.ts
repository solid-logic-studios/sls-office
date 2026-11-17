import type { MusicNote, MusicScore, MusicVoice, SynthNote } from '../../contract/theme.ts';

/** BPM: targets snap to this, so load jitter does not wobble the tempo. */
export const TEMPO_GRID = 2;
/** BPM: the most the tempo moves at one bar line. */
export const MAX_CHANGE_PER_BAR = 4;
/** How often the scheduler wakes (ms), how far ahead of the audio clock it schedules, and the first step's lead (s). */
export const TICK_MS = 100;
export const LOOKAHEAD = 0.25;
export const START_DELAY = 0.1;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** The tempo a lab at `load` (0 to 1) asks for: `calm` to `busy`, snapped to the grid. */
export function targetBpm(score: MusicScore, load: number): number {
  const { calm, busy } = score.bpm;
  return calm + Math.round(((busy - calm) * clamp(load, 0, 1)) / TEMPO_GRID) * TEMPO_GRID;
}

/** The tempo for the next bar: `current` moved towards `target` by at most `MAX_CHANGE_PER_BAR`. */
export function nextBpm(current: number, target: number): number {
  return current + clamp(target - current, -MAX_CHANGE_PER_BAR, MAX_CHANGE_PER_BAR);
}

/** A music note as the output's existing note scheduling plays it. A note is never shorter than its attack. */
export function toSynthNote(voice: MusicVoice, note: MusicNote, stepSeconds: number): SynthNote {
  return {
    wave: voice.wave,
    startHz: note.hz,
    endHz: note.hz,
    attack: voice.attack,
    sustain: Math.max(0, note.steps * stepSeconds * voice.gate - voice.attack),
    decay: voice.release,
    volume: voice.volume,
  };
}

/** Plays one note of `voice` at an audio-clock time. Supplied by the output, so the sequencer needs no Web Audio. */
export type NotePlayer = (voice: string, note: SynthNote, at: number) => void;

/** What a voice plays on one step. */
interface Onset {
  voice: string;
  note: MusicNote;
}

/**
 * Steps through a `MusicScore` on a clock it is given (the audio clock, in seconds), handing each note to
 * `play` a little ahead of time. The tempo follows the latest load but moves only at bar lines, so a bar
 * never changes speed under its own notes. The loop is not special: the order wraps and the next step
 * follows at the usual time, so there is no gap.
 */
export class MusicSequencer {
  /** For each section, the notes that start on each step, found once up front so a tick is a lookup. */
  private readonly onsets: readonly (readonly (readonly Onset[])[])[];
  private load = 0;
  private bpm: number;
  private orderIndex = 0;
  private step = 0;
  private firstBar = true;
  private nextStepAt = 0;

  constructor(
    private readonly score: MusicScore,
    private readonly play: NotePlayer,
  ) {
    this.bpm = targetBpm(score, 0);
    this.onsets = score.sections.map((section) => {
      const steps: Onset[][] = Array.from({ length: section.bars * score.stepsPerBar }, () => []);
      for (const [voice, notes] of Object.entries(section.parts)) {
        for (const note of notes ?? []) steps[note.step]?.push({ voice, note });
      }
      return steps;
    });
  }

  /** Stores the latest load (0 to 1). It never touches a note already scheduled. */
  setLoad(load: number): void {
    this.load = clamp(load, 0, 1);
  }

  /** Begins at the top of the order, the first bar at the tempo the current load asks for. */
  start(now: number): void {
    this.bpm = targetBpm(this.score, this.load);
    this.orderIndex = 0;
    this.step = 0;
    this.firstBar = true;
    this.nextStepAt = now + START_DELAY;
  }

  /** Schedules every step that falls in the next `LOOKAHEAD` seconds of the clock. */
  tick(now: number): void {
    // A throttled timer (a hidden tab) must not release a burst of notes when it wakes: resume from here.
    if (this.nextStepAt < now) this.nextStepAt = now + START_DELAY;
    const { score } = this;
    while (this.nextStepAt < now + LOOKAHEAD) {
      const sectionIndex = score.order[this.orderIndex] ?? 0;
      const section = score.sections[sectionIndex];
      if (section === undefined) return;
      if (this.step % score.stepsPerBar === 0) {
        if (!this.firstBar) this.bpm = nextBpm(this.bpm, targetBpm(score, this.load));
        this.firstBar = false;
      }
      const stepSeconds = 60 / (this.bpm * score.stepsPerBeat);
      for (const { voice, note } of this.onsets[sectionIndex]?.[this.step] ?? []) {
        const style = score.voices[voice];
        if (style !== undefined) this.play(voice, toSynthNote(style, note, stepSeconds), this.nextStepAt);
      }
      this.nextStepAt += stepSeconds;
      this.step += 1;
      if (this.step === section.bars * score.stepsPerBar) {
        this.step = 0;
        this.orderIndex = (this.orderIndex + 1) % score.order.length;
      }
    }
  }
}
