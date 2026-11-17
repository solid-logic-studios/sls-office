import type { MusicScore, SynthNote } from '../../contract/theme.ts';
import { holdAt } from './ambient-bed.ts';
import { MusicSequencer, TICK_MS } from './music-sequencer.ts';

/** Time constant (seconds) of the fade-in: about 1.5 s to full, so the music arrives rather than starts. */
const FADE_IN = 0.5;
/** Time constant (seconds) of the fade-out, and how long after it the gain is released (4 time constants). */
const FADE_OUT = 0.1;
const STOP_AFTER = 0.4;

/** Plays one note on the audio clock into `out`. Supplied by the output so music uses its note scheduling. */
export type MusicNotePlayer = (note: SynthNote, at: number, out: AudioNode) => void;

/**
 * One running piece of music: a `MusicSequencer` on the audio clock, a timer to wake it, and one `music` gain
 * every note passes through into the `ambient` channel. It fades in from silence. `stop` fades it out and
 * releases the gain, so an all-day kiosk does not leak; notes already scheduled ring out under that fade.
 */
export class RunningMusic {
  private readonly gain: GainNode;
  private readonly sequencer: MusicSequencer;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly context: AudioContext,
    out: AudioNode,
    readonly score: MusicScore,
    load: number,
    playNote: MusicNotePlayer,
  ) {
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(out);
    this.gain.gain.setTargetAtTime(score.volume, context.currentTime, FADE_IN);

    this.sequencer = new MusicSequencer(score, (_voice, note, at) => playNote(note, at, this.gain));
    this.sequencer.setLoad(load);
    this.sequencer.start(context.currentTime);
    this.sequencer.tick(context.currentTime);
    this.timer = setInterval(() => this.sequencer.tick(this.context.currentTime), TICK_MS);
  }

  /** The tempo follows this from the next bar line. */
  setLoad(load: number): void {
    this.sequencer.setLoad(load);
  }

  /** Fades out, then disconnects the gain. Safe to call once. */
  stop(): void {
    clearInterval(this.timer);
    holdAt(this.gain.gain, this.context.currentTime);
    this.gain.gain.setTargetAtTime(0, this.context.currentTime, FADE_OUT);
    setTimeout(() => this.gain.disconnect(), STOP_AFTER * 1000);
  }
}
