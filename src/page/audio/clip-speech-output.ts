import type { ClipPlayer } from './clip-player.ts';
import { clipKey } from './clip-key.ts';
import type { SpeechOutput, SpokenLine } from './speech-output.ts';
import type { VoiceManifest } from './voice-manifest.ts';

/** How far a clip's playback rate may stray from normal: past this the voice stops sounding natural. */
const MIN_PLAYBACK_RATE = 0.85;
const MAX_PLAYBACK_RATE = 1.15;

export interface ClipSpeechOptions {
  player: ClipPlayer;
  /** Says any line without a clip, or whose clip would not play. */
  fallback: SpeechOutput;
  /** Where the manifest's file names live, with its trailing slash, for example `voices/`. */
  baseUrl: string;
}

/** One thing said in turn within an Announcement: a clip's line, or a run of words for the fallback. */
interface Segment {
  line: SpokenLine;
  clip: boolean;
}

/** The Announcement being said: `cancel` stops it starting the next piece, `finish` ends it (once). */
interface Sequence {
  cancel(): void;
  finish(): void;
}

/**
 * Speaks a line by playing its pre-rendered clip when the image has one, else through the fallback
 * (`speechSynthesis`). The clip is the Voice's own Piper voice at the Voice's own rate; all that is left
 * to vary per character is a small pitch nudge, applied as the clip's playback rate. An Announcement (a line
 * with `pieces`) is stitched: each piece plays its own clip, and the pieces with none go through the fallback.
 */
export class ClipSpeechOutput implements SpeechOutput {
  private readonly player: ClipPlayer;
  private readonly fallback: SpeechOutput;
  private readonly baseUrl: string;
  private manifest: VoiceManifest = new Map();
  /** What is speaking now, so `stop()` cuts off the right one. */
  private active: 'clip' | 'fallback' | null = null;
  /** The Announcement being said, if any, so `stop()` can abandon its remaining pieces. */
  private sequence: Sequence | null = null;

  constructor({ player, fallback, baseUrl }: ClipSpeechOptions) {
    this.player = player;
    this.fallback = fallback;
    this.baseUrl = baseUrl;
  }

  /** Swaps in the manifest once it has loaded. Until then every line goes through the fallback. */
  useManifest(manifest: VoiceManifest): void {
    this.manifest = manifest;
  }

  speak(line: SpokenLine, onEnd: () => void): void {
    if (line.pieces === undefined) this.speakOne(line, onEnd);
    else this.speakPieces(line, line.pieces, onEnd);
  }

  stop(): void {
    const sequence = this.sequence;
    const active = this.active;
    this.sequence = null;
    this.active = null;
    // Flag the sequence first, so the piece cut off does not start the next one.
    sequence?.cancel();
    if (active === 'clip') this.player.stop();
    else if (active === 'fallback') this.fallback.stop();
    sequence?.finish();
  }

  setVolume(level: number): void {
    this.player.setVolume(level);
    this.fallback.setVolume(level);
  }

  /** Plays the clip for `line` if there is one, else says it through the fallback. */
  private speakOne(line: SpokenLine, onEnd: () => void): void {
    const file = this.clipFor(line);
    if (file === undefined) {
      this.sayWithFallback(line, onEnd);
      return;
    }
    let ended = false;
    this.active = 'clip';
    this.player.play(`${this.baseUrl}${file}`, playbackRate(line), (failed) => {
      if (ended) return;
      ended = true;
      if (failed) this.sayWithFallback(line, onEnd);
      else {
        this.active = null;
        onEnd();
      }
    });
  }

  /**
   * Says an Announcement piece by piece: each piece with a clip plays it, and a run of pieces without one is
   * joined into a single fallback utterance, so the browser's voice is not restarted word by word. `onEnd`
   * fires once, after the last piece or when `stop()` abandons the rest.
   */
  private speakPieces(line: SpokenLine, pieces: readonly string[], onEnd: () => void): void {
    const segments = this.segmentsOf(line, pieces);
    let finished = false;
    let cancelled = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      if (this.sequence === sequence) this.sequence = null;
      onEnd();
    };
    const sequence: Sequence = {
      cancel: () => {
        cancelled = true;
      },
      finish,
    };
    this.sequence = sequence;
    let index = 0;
    const next = (): void => {
      const segment = segments[index++];
      if (cancelled || segment === undefined) finish();
      else if (segment.clip) this.speakOne(segment.line, next);
      else this.sayWithFallback(segment.line, next);
    };
    next();
  }

  /** The plain lines to say in turn: one per piece with a clip, one per run of pieces without. */
  private segmentsOf(line: SpokenLine, pieces: readonly string[]): Segment[] {
    const segments: Segment[] = [];
    for (const piece of pieces) {
      const plain: SpokenLine = { ...line, text: piece, pieces: undefined };
      const clip = this.clipFor(plain) !== undefined;
      const last = segments.at(-1);
      if (!clip && last !== undefined && !last.clip) last.line = { ...last.line, text: `${last.line.text} ${piece}` };
      else segments.push({ line: plain, clip });
    }
    return segments;
  }

  private clipFor(line: SpokenLine): string | undefined {
    return line.voice.piper === undefined ? undefined : this.manifest.get(clipKey(line.voice.id, line.text));
  }

  private sayWithFallback(line: SpokenLine, onEnd: () => void): void {
    this.active = 'fallback';
    this.fallback.speak(line, () => {
      this.active = null;
      onEnd();
    });
  }
}

/**
 * The per-character pitch nudge: how far the line's pitch strays from its Voice's, added to normal speed.
 * It is the difference, not a ratio, so it does not depend on the Voice's own pitch, which only steers the
 * `speechSynthesis` fallback (the Piper model is the pitch, and the rate is baked in at render time).
 */
function playbackRate({ pitch, voice }: SpokenLine): number {
  return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, 1 + (pitch - voice.pitch)));
}
