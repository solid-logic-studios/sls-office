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

/**
 * Speaks a line by playing its pre-rendered clip when the image has one, else through the fallback
 * (`speechSynthesis`). The clip is the Voice's own Piper voice at the Voice's own rate; all that is left
 * to vary per character is a small pitch nudge, applied as the clip's playback rate.
 */
export class ClipSpeechOutput implements SpeechOutput {
  private readonly player: ClipPlayer;
  private readonly fallback: SpeechOutput;
  private readonly baseUrl: string;
  private manifest: VoiceManifest = new Map();
  /** What is speaking now, so `stop()` cuts off the right one. */
  private active: 'clip' | 'fallback' | null = null;

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
    const file = line.voice.piper === undefined ? undefined : this.manifest.get(clipKey(line.voice.id, line.text));
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

  stop(): void {
    const active = this.active;
    this.active = null;
    if (active === 'clip') this.player.stop();
    else if (active === 'fallback') this.fallback.stop();
  }

  setVolume(level: number): void {
    this.player.setVolume(level);
    this.fallback.setVolume(level);
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
