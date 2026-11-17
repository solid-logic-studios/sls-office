import type { AmbientBed, SynthNote, SynthSound } from '../../contract/theme.ts';
import { RunningBed, holdAt } from './ambient-bed.ts';
import { noteSeconds, type AmbientMix, type Channel, type PlayOptions, type SoundOutput } from './sound-output.ts';

/** An exponential ramp cannot reach 0, so envelopes fall to this instead. */
const FLOOR = 0.0001;
const NOISE_SECONDS = 1;
/** Time constant (seconds) for a channel level change: long enough that it never clicks, short enough to feel prompt. */
const LEVEL_GLIDE = 0.03;
/** Time constant (seconds) of the fade a stopped sound takes, and how long after it the source is cut. */
const STOP_FADE = 0.01;
const STOP_AFTER = 0.06;

/** One scheduled note, kept so `stop` can fade and cut it. */
interface LiveNote {
  source: AudioScheduledSourceNode;
  gain: GainNode;
}

/**
 * Plays a `SynthSound` through Web Audio. The only file that touches `AudioContext`. A browser that
 * blocks autoplay keeps the context suspended until a click or key press; until then sound is dropped
 * silently, never queued.
 */
export class WebAudioOutput implements SoundOutput {
  /**
   * Created up front, so where autoplay is allowed (the Pi kiosk) it is already running when the first
   * Alarm arrives. `null` where the browser has no Web Audio.
   */
  private readonly context: AudioContext | null = typeof AudioContext === 'undefined' ? null : new AudioContext();
  private noise: AudioBuffer | null = null;
  /** One gain per channel, created on first use, all into `destination`. */
  private readonly channels = new Map<Channel, GainNode>();
  /** The notes still scheduled or sounding on each channel; each leaves on `ended`, so nothing accumulates. */
  private readonly live = new Map<Channel, Set<LiveNote>>();
  /** The bed that is sounding now, if any. */
  private running: RunningBed | null = null;
  /** The bed the Soundboard last asked for, kept so a context that was blocked can start it once it runs. */
  private requested: { bed: AmbientBed; mix: AmbientMix } | null = null;

  constructor() {
    this.context?.addEventListener('statechange', () => this.startRequestedBed());
  }

  /** True when there is Web Audio but the browser is holding it back until a gesture. */
  get blocked(): boolean {
    return this.context !== null && this.context.state !== 'running';
  }

  /** Calls `listener` whenever the context changes state (for example, from suspended to running). */
  onChange(listener: () => void): void {
    this.context?.addEventListener('statechange', listener);
  }

  /** Asks the browser to start audio. Only works inside a gesture it accepts; a refusal is ignored. */
  unlock(): void {
    this.context?.resume().catch(() => {
      // Still blocked; the next gesture tries again.
    });
  }

  /**
   * Resumes audio on the first gesture the browser accepts. A touch `pointerdown` or an Escape key press
   * does not count as one in Chromium, so the listeners stay until the context is actually running.
   */
  unlockOnGesture(target: Document): void {
    const events = ['click', 'pointerup', 'keydown'] as const;
    const unlock = (): void => this.unlock();
    const settle = (): void => {
      if (this.blocked) return;
      for (const event of events) target.removeEventListener(event, unlock);
    };
    for (const event of events) target.addEventListener(event, unlock);
    this.onChange(settle);
  }

  play(sound: SynthSound, options: PlayOptions): void {
    const { context } = this;
    if (context === null || context.state !== 'running') return;
    this.playAt(context, sound, options, context.currentTime);
  }

  /**
   * Runs the bed at `mix`; `null` fades it out and releases it. A bed that was asked for while the context
   * was blocked starts when the context runs. A different `bed` object than the running one rebuilds it.
   */
  ambient(bed: AmbientBed | null, mix: AmbientMix): void {
    this.requested = bed === null ? null : { bed, mix };
    if (bed === null) {
      this.running?.stop();
      this.running = null;
      return;
    }
    this.startRequestedBed();
  }

  private startRequestedBed(): void {
    const { context, requested } = this;
    if (context === null || context.state !== 'running' || requested === null) return;
    if (this.running !== null && this.running.bed !== requested.bed) {
      this.running.stop();
      this.running = null;
    }
    this.running ??= new RunningBed(
      context,
      this.channelGain(context, 'ambient'),
      requested.bed,
      this.noiseBuffer(context),
      (sound, pan, at) => this.playAt(context, sound, { channel: 'ambient', volume: 1, pan }, at),
    );
    this.running.setMix(requested.mix);
  }

  private playAt(context: AudioContext, sound: SynthSound, { channel, volume, pan }: PlayOptions, start: number): void {
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.channelGain(context, channel));
    let at = start;
    let last: AudioScheduledSourceNode | null = null;
    for (const note of sound.notes) {
      last = this.schedule(context, panner, channel, note, at, volume);
      at += noteSeconds(note);
    }
    // Free the graph once the sound has finished, so an all-day kiosk does not accumulate nodes.
    if (last === null) panner.disconnect();
    else last.addEventListener('ended', () => panner.disconnect());
  }

  setLevel(channel: Channel, level: number): void {
    const { context } = this;
    if (context === null) return;
    const { gain } = this.channelGain(context, channel);
    const now = context.currentTime;
    holdAt(gain, now);
    gain.setTargetAtTime(level, now, LEVEL_GLIDE);
  }

  /**
   * Fades every note on the channel out over a few milliseconds, then cuts it, so a stop never clicks. On
   * `ambient` that cuts the clatter's key presses; the bed's room tone and hum are `ambient(null)`'s to stop.
   */
  stop(channel: Channel): void {
    const { context } = this;
    const notes = this.live.get(channel);
    if (context === null || notes === undefined) return;
    const now = context.currentTime;
    for (const { source, gain } of notes) {
      holdAt(gain.gain, now);
      gain.gain.setTargetAtTime(0, now, STOP_FADE);
      source.stop(now + STOP_AFTER);
    }
  }

  private channelGain(context: AudioContext, channel: Channel): GainNode {
    let gain = this.channels.get(channel);
    if (gain === undefined) {
      gain = context.createGain();
      gain.connect(context.destination);
      this.channels.set(channel, gain);
    }
    return gain;
  }

  private liveNotes(channel: Channel): Set<LiveNote> {
    let notes = this.live.get(channel);
    if (notes === undefined) {
      notes = new Set();
      this.live.set(channel, notes);
    }
    return notes;
  }

  private schedule(
    context: AudioContext,
    out: AudioNode,
    channel: Channel,
    note: SynthNote,
    at: number,
    volume: number,
  ): AudioScheduledSourceNode {
    const peak = Math.max(FLOOR, note.volume * volume);
    const end = at + note.attack + note.sustain + note.decay;
    const gain = context.createGain();
    gain.gain.setValueAtTime(FLOOR, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + note.attack);
    gain.gain.setValueAtTime(peak, at + note.attack + note.sustain);
    gain.gain.exponentialRampToValueAtTime(FLOOR, end);
    gain.connect(out);

    const source = this.source(context, note, at, end);
    source.connect(gain);
    source.start(at);
    source.stop(end);
    const live: LiveNote = { source, gain };
    const notes = this.liveNotes(channel);
    notes.add(live);
    source.addEventListener('ended', () => {
      notes.delete(live);
      gain.disconnect();
    });
    return source;
  }

  private source(context: AudioContext, note: SynthNote, at: number, end: number): AudioScheduledSourceNode {
    if (note.wave === 'noise') {
      const node = context.createBufferSource();
      node.buffer = this.noiseBuffer(context);
      node.loop = true;
      return node;
    }
    const oscillator = context.createOscillator();
    oscillator.type = note.wave;
    oscillator.frequency.setValueAtTime(note.startHz, at);
    oscillator.frequency.linearRampToValueAtTime(note.endHz, end);
    return oscillator;
  }

  private noiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noise === null) {
      const buffer = context.createBuffer(1, context.sampleRate * NOISE_SECONDS, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }
}
