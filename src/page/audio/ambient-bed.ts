import type { AmbientBed, SynthSound } from '../../contract/theme.ts';
import type { AmbientMix } from './sound-output.ts';

/** Time constant (seconds) for a layer's gain to glide to a new mix: slow, because the bed is never meant to be noticed. */
const MIX_GLIDE = 0.4;
/** Time constant (seconds) of the fade-out, and how long after it the sources are cut (4 time constants, under 2% left). */
const FADE_OUT = 0.1;
const STOP_AFTER = 0.4;
/** How often the clatter scheduler wakes, and how far ahead of the audio clock it schedules key presses (seconds). */
const TICK_MS = 100;
const LOOKAHEAD = 0.2;
/** Each key press lands at a random place within this much of the centre of the stereo field. */
const MAX_PAN = 0.5;

/** Plays one key press at an audio-clock time, panned. Supplied by the output so keys use its note scheduling. */
export type KeyPlayer = (sound: SynthSound, pan: number, at: number) => void;

/**
 * Drops whatever was scheduled on `param` from `now` on but keeps its current value, so a glide that is
 * interrupted carries on from where it is and never clicks. (A bare `cancelScheduledValues` mid-ramp snaps
 * back to the ramp's starting value.)
 */
export function holdAt(param: AudioParam, now: number): void {
  const { value } = param;
  param.cancelScheduledValues(now);
  param.setValueAtTime(value, now);
}

/**
 * One running ambient bed: a room tone and a hum, each with its own gain, and a lookahead scheduler for the
 * keyboard clatter. It starts silent and glides up to its mix. `stop` fades it out and releases every node,
 * so an all-day kiosk does not leak.
 */
export class RunningBed {
  private readonly room: GainNode;
  private readonly hum: GainNode;
  private readonly nodes: AudioNode[];
  private readonly sources: AudioScheduledSourceNode[];
  private readonly timer: ReturnType<typeof setInterval>;
  private keysPerSecond = 0;
  /** Audio-clock time of the next key press to schedule. */
  private nextKeyAt: number;

  constructor(
    private readonly context: AudioContext,
    out: AudioNode,
    readonly bed: AmbientBed,
    noise: AudioBuffer,
    private readonly playKey: KeyPlayer,
  ) {
    this.nextKeyAt = context.currentTime;

    const wash = context.createBufferSource();
    wash.buffer = noise;
    wash.loop = true;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = bed.room.lowpassHz;
    this.room = context.createGain();
    this.room.gain.value = 0;
    wash.connect(lowpass).connect(this.room).connect(out);

    const drone = context.createOscillator();
    drone.type = bed.hum.wave;
    drone.frequency.value = bed.hum.hz;
    this.hum = context.createGain();
    this.hum.gain.value = 0;
    drone.connect(this.hum).connect(out);

    this.sources = [wash, drone];
    this.nodes = [lowpass, this.room, this.hum];
    wash.start();
    drone.start();
    this.timer = setInterval(() => this.scheduleKeys(), TICK_MS);
  }

  /** Glides each layer to `mix` and sets the clatter rate. */
  setMix(mix: AmbientMix): void {
    const now = this.context.currentTime;
    for (const [gain, level] of [
      [this.room, mix.room],
      [this.hum, mix.hum],
    ] as const) {
      holdAt(gain.gain, now);
      gain.gain.setTargetAtTime(level, now, MIX_GLIDE);
    }
    this.keysPerSecond = mix.keysPerSecond;
  }

  /** Fades the layers out, then stops the sources and disconnects everything. Safe to call once. */
  stop(): void {
    clearInterval(this.timer);
    const now = this.context.currentTime;
    for (const { gain } of [this.room, this.hum]) {
      holdAt(gain, now);
      gain.setTargetAtTime(0, now, FADE_OUT);
    }
    for (const source of this.sources) {
      source.addEventListener('ended', () => source.disconnect());
      source.stop(now + STOP_AFTER);
    }
    // The gains outlive the sources by a moment; release them when the last source has ended.
    const last = this.sources.at(-1);
    last?.addEventListener('ended', () => {
      for (const node of this.nodes) node.disconnect();
    });
  }

  /** Schedules the key presses that fall in the next `LOOKAHEAD` seconds, spaced at random (a Poisson process). */
  private scheduleKeys(): void {
    const now = this.context.currentTime;
    // A throttled timer (a hidden tab) must not release a burst of keys when it wakes.
    if (this.nextKeyAt < now) this.nextKeyAt = now;
    if (this.keysPerSecond <= 0) return;
    while (this.nextKeyAt < now + LOOKAHEAD) {
      this.playKey(this.bed.clatter.key, (Math.random() * 2 - 1) * MAX_PAN, this.nextKeyAt);
      this.nextKeyAt += -Math.log(1 - Math.random()) / this.keysPerSecond;
    }
  }
}
