import type { SynthNote, SynthSound } from '../../contract/theme.ts';
import type { SoundOutput } from './sound-output.ts';

/** An exponential ramp cannot reach 0, so envelopes fall to this instead. */
const FLOOR = 0.0001;
const NOISE_SECONDS = 1;

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

  /** Resumes audio on the first pointer or key press on `target`. */
  unlockOnGesture(target: Document): void {
    const unlock = (): void => {
      target.removeEventListener('pointerdown', unlock);
      target.removeEventListener('keydown', unlock);
      void this.context?.resume();
    };
    target.addEventListener('pointerdown', unlock);
    target.addEventListener('keydown', unlock);
  }

  play(sound: SynthSound, { volume, pan }: { volume: number; pan: number }): void {
    const { context } = this;
    if (context === null || context.state !== 'running') return;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(context.destination);
    let at = context.currentTime;
    for (const note of sound.notes) {
      this.schedule(context, panner, note, at, volume);
      at += note.attack + note.sustain + note.decay + (note.gap ?? 0);
    }
  }

  private schedule(context: AudioContext, out: AudioNode, note: SynthNote, at: number, volume: number): void {
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
