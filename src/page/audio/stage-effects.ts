import type { EffectName, SynthSound } from '../../contract/theme.ts';
import type { CharacterView } from '../../engine/engine.ts';
import type { EngineEventOf } from '../../engine/events.ts';
import type { SoundSource } from './soundboard.ts';
import type { PlayOptions } from './sound-output.ts';

/** The same effect plays at most once in this long, so a burst of paper or arrivals never machine-guns. */
export const EFFECT_THROTTLE_MS = 1500;

/** The bottom storey: `layout.floors` lists the bottom storey first, so the ground floor is index 0. */
export const GROUND_FLOOR = 0;

/** Each floor away from the ground floor halves an effect's volume (one floor up: 0.5, two: 0.25). */
export const FLOOR_ATTENUATION = 0.5;

/** Where an effect sounds, as the Soundboard's output wants it, without the channel. */
type Placement = Pick<PlayOptions, 'volume' | 'pan'>;

/** Where one effect plays (a sound and where it comes from), handed to whoever owns the speakers. */
export type EffectSink = (sound: SynthSound, placement: Placement) => void;

/** Everything from the Engine the effects need. The real `Engine` satisfies it, as it does `SoundSource`. */
export type EffectSource = Pick<SoundSource, 'bus' | 'theme' | 'characters' | 'layout'>;

const CENTRE: Placement = { volume: 1, pan: 0 };

/** Pan from x across the stage width, quieter per floor away from the ground; centred and full for a stranger. */
function placement(character: CharacterView | undefined, width: number): Placement {
  if (character === undefined) return CENTRE;
  const pan = (character.x / width) * 2 - 1;
  return {
    pan: Math.min(1, Math.max(-1, pan)),
    volume: FLOOR_ATTENUATION ** Math.abs(character.floor - GROUND_FLOOR),
  };
}

/**
 * Stage sound effects (ADR 0004): which effect a bus event makes, and where it sounds. It maps events to
 * the Theme's `EffectName`s, pans each by the character's x position, makes other floors quieter, and
 * lets the same effect through at most once per `EFFECT_THROTTLE_MS` on the injected clock. Muting and
 * channels are the Soundboard's business: this only hands a sound and its placement to the sink.
 */
export class StageEffects {
  private readonly unsubscribe: readonly (() => void)[];
  private readonly lastPlayed = new Map<EffectName, number>();

  constructor(
    private readonly source: EffectSource,
    private readonly sink: EffectSink,
    private readonly now: () => number,
  ) {
    const { bus } = source;
    this.unsubscribe = [
      bus.subscribe('deploy', (event) => {
        if (event.phase === 'started') this.at('deployStarted', event.subject);
        else if (event.phase === 'healthy') this.at('deployHealthy', event.subject);
      }),
      bus.subscribe('paper', (event) => this.at('paper', event.fromId)),
      bus.subscribe('visitor', (event) => this.at('visitor', event.targetId)),
      bus.subscribe('check-in', (event) => this.at('checkIn', event.toId)),
      bus.subscribe('workload-added', (event) => this.at('workloadAdded', event.workload.id)),
      bus.subscribe('workload-removed', (event) => this.at('workloadRemoved', event.workload.id)),
      bus.subscribe('backup', (event) => this.onBackup(event)),
    ];
  }

  dispose(): void {
    for (const stop of this.unsubscribe) stop();
  }

  private onBackup(event: EngineEventOf<'backup'>): void {
    // A failed backup is an Alarm, not an effect.
    if (event.phase === 'failed') return;
    this.effect(event.phase === 'started' ? 'backupStarted' : 'backupFinished', () =>
      this.source.characters().find((character) => character.part === 'keeper'),
    );
  }

  /** Plays `name` from where the character `id` stands. */
  private at(name: EffectName, id: string): void {
    this.effect(name, () => this.find(id));
  }

  /**
   * Plays `name` from where `locate` finds its character, unless the Theme has no such sound or it sounded
   * too lately. `locate` only runs once the effect will play, so a skipped effect never reads the cast.
   */
  private effect(name: EffectName, locate: () => CharacterView | undefined): void {
    const sound = this.source.theme.soundscape?.effects?.[name];
    if (sound === undefined) return;
    const now = this.now();
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < EFFECT_THROTTLE_MS) return;
    this.lastPlayed.set(name, now);
    this.sink(sound, placement(locate(), this.source.layout.width));
  }

  /**
   * A workload's character is its own id, or `id#n` once a deploy has cast a newcomer. Prefer a visible
   * one, and of those the latest.
   */
  private find(id: string): CharacterView | undefined {
    const matches = this.source
      .characters()
      .filter((character) => character.id === id || character.id.startsWith(`${id}#`));
    return matches.findLast((character) => character.visible) ?? matches.at(-1);
  }
}
