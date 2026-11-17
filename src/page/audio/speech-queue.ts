import type { SpeechOutput, SpokenLine } from './speech-output.ts';

/** At most one voiced line per this long, measured from the start of one line to the start of the next. */
export const SPEECH_GAP_MS = 8000;
/** A waiting line older than this when its turn comes is dropped: it is no longer news. */
export const SPEECH_STALE_MS = 4000;
/** How many lines may wait behind the one being said. A newer line pushes out the oldest. */
export const SPEECH_QUEUE_MAX = 2;

export interface SpeechQueueOptions {
  /** Milliseconds on a monotonic clock. */
  now: () => number;
  /** Runs `callback` after `ms`. It cannot be cancelled, so a stale wake-up must be harmless. */
  later: (callback: () => void, ms: number) => void;
  /** Told when a line starts being said (`true`) and when nothing is being said any more (`false`). */
  onSpeaking: (speaking: boolean) => void;
}

interface Waiting {
  line: SpokenLine;
  /** When it was enqueued. */
  at: number;
}

/**
 * Decides which line is said when (ADR 0004): one at a time, at most `SPEECH_QUEUE_MAX` waiting (the
 * oldest is dropped for a newer one), a waiting line older than `SPEECH_STALE_MS` is dropped, and a line
 * starts no sooner than `SPEECH_GAP_MS` after the last one started. Saying the line is the
 * `SpeechOutput`'s job.
 */
export class SpeechQueue {
  private waiting: Waiting[] = [];
  /** The Announcement waiting its turn, if any. Only one waits: a newer one replaces it. */
  private announcement: SpokenLine | null = null;
  /**
   * The line being said now. Marked `done` once it has ended or been cut off, so a late `onEnd` is ignored, and
   * `announcement` when it is one, so a second tap does not say the same status again straight after.
   */
  private current: { done: boolean; announcement: boolean } | null = null;
  private lastStart: number | null = null;
  private held = false;
  private wakePending = false;

  constructor(
    private readonly output: SpeechOutput,
    private readonly options: SpeechQueueOptions,
  ) {}

  /** Queues `line` and starts it if it is its turn. */
  enqueue(line: SpokenLine): void {
    this.waiting.push({ line, at: this.options.now() });
    while (this.waiting.length > SPEECH_QUEUE_MAX) this.waiting.shift();
    this.pump();
  }

  /**
   * Says an Announcement as soon as the line being said ends (or the Alarm lets go), ahead of any waiting
   * lines. It ignores the gap and the stale rule, counts as the last start, and never talks over anything.
   * A newer Announcement replaces one still waiting, and is dropped while one is being said (a double tap).
   */
  announce(line: SpokenLine): void {
    if (this.current?.announcement === true) return;
    this.announcement = line;
    this.pump();
  }

  /**
   * Says `line` at once: it cuts off the line being said, forgets the waiting ones and ignores the gap (it
   * still counts as the last start). Dropped while held, so an Alarm is not talked over.
   */
  sayNow(line: SpokenLine): void {
    if (this.held) return;
    this.interrupt();
    this.start(line);
  }

  /**
   * Cuts off the line being said and forgets the waiting ones, an Announcement included. The 8 s gap still
   * counts from the last start.
   */
  interrupt(): void {
    this.waiting = [];
    this.announcement = null;
    const current = this.current;
    if (current === null) return;
    current.done = true;
    this.current = null;
    this.options.onSpeaking(false);
    this.output.stop();
  }

  /** While held nothing new starts (a line already being said carries on); releasing starts the next one due. */
  hold(on: boolean): void {
    this.held = on;
    if (!on) this.pump();
  }

  private pump(): void {
    if (this.held || this.current !== null) return;
    if (this.announcement !== null) {
      const line = this.announcement;
      this.announcement = null;
      this.start(line, true);
      return;
    }
    const { now } = this.options;
    this.waiting = this.waiting.filter((entry) => now() - entry.at <= SPEECH_STALE_MS);
    const next = this.waiting[0];
    if (next === undefined) return;
    if (this.lastStart !== null) {
      const wait = this.lastStart + SPEECH_GAP_MS - now();
      if (wait > 0) {
        this.wake(wait);
        return;
      }
    }
    this.waiting.shift();
    this.start(next.line);
  }

  private start(line: SpokenLine, announcement = false): void {
    const current = { done: false, announcement };
    this.current = current;
    this.lastStart = this.options.now();
    this.options.onSpeaking(true);
    this.output.speak(line, () => {
      if (current.done) return;
      current.done = true;
      this.current = null;
      this.options.onSpeaking(false);
      this.pump();
    });
  }

  /** Wakes the queue when the gap closes. One pending wake-up is enough, and a stale one only pumps. */
  private wake(ms: number): void {
    if (this.wakePending) return;
    this.wakePending = true;
    this.options.later(() => {
      this.wakePending = false;
      this.pump();
    }, ms);
  }
}
