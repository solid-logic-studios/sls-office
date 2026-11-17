import type { SpeechOutput, SpokenLine } from '../../src/page/audio/speech-output.ts';

/** A `SpeechOutput` that remembers what it was asked to say and stop, and lets the test end a line by hand. */
export class RecordingSpeechOutput implements SpeechOutput {
  /** Every line started, in order. */
  readonly spoken: SpokenLine[] = [];
  /** How many times `stop()` was called. */
  stops = 0;
  /** The volume last set, if any. */
  volume: number | undefined;
  private onEnd: (() => void) | null = null;

  /** The line being said now, if any. */
  get current(): SpokenLine | undefined {
    return this.onEnd === null ? undefined : this.spoken.at(-1);
  }

  speak(line: SpokenLine, onEnd: () => void): void {
    this.spoken.push(line);
    this.onEnd = onEnd;
  }

  setVolume(level: number): void {
    this.volume = level;
  }

  /** Like the real thing, cutting a line off still reports it ended. */
  stop(): void {
    this.stops += 1;
    this.finish();
  }

  /** Ends the current line as if it had been said in full. */
  finish(): void {
    const onEnd = this.onEnd;
    this.onEnd = null;
    onEnd?.();
  }

  get texts(): string[] {
    return this.spoken.map((line) => line.text);
  }
}
