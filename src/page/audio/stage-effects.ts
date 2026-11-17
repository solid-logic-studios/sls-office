import type { EffectName, SynthSound } from '../../contract/theme.ts';
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
        if (event.phase === 'started') this.effect('deployStarted', event.subject);
        else if (event.phase === 'healthy') this.effect('deployHealthy', event.subject);
      }),
      bus.subscribe('paper', (event) => this.effect('paper', event.fromId)),
      bus.subscribe('visitor', (event) => this.effect('visitor', event.targetId)),
      bus.subscribe('check-in', (event) => this.effect('checkIn', event.toId)),
      bus.subscribe('workload-added', (event) => this.effect('workloadAdded', event.workload.id)),
      bus.subscribe('workload-removed', (event) => this.effect('workloadRemoved', event.workload.id)),
      bus.subscribe('backup', (event) => this.onBackup(event)),
    ];
  }

  dispose(): void {
    for (const stop of this.unsubscribe) stop();
  }

  private onBackup(event: EngineEventOf<'backup'>): void {
    // A failed backup is an Alarm, not an effect.
    if (event.phase === 'failed') return;
    const keeper = this.source.characters().find((character) => character.part === 'keeper');
    this.effect(event.phase === 'started' ? 'backupStarted' : 'backupFinished', keeper?.id);
  }

  /** Plays `name` from `characterId`'s place, unless the Theme has no such sound or it sounded too lately. */
  private effect(name: EffectName, characterId: string | undefined): void {
    const sound = this.source.theme.soundscape?.effects?.[name];
    if (sound === undefined) return;
    const now = this.now();
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < EFFECT_THROTTLE_MS) return;
    this.lastPlayed.set(name, now);
    this.sink(sound, this.placement(characterId));
  }

  /** Pan from x across the stage width, quieter per floor away from the ground; centred and full for a stranger. */
  private placement(characterId: string | undefined): Placement {
    const character = characterId === undefined ? undefined : this.find(characterId);
    if (character === undefined) return CENTRE;
    const pan = (character.x / this.source.layout.width) * 2 - 1;
    return {
      pan: Math.min(1, Math.max(-1, pan)),
      volume: FLOOR_ATTENUATION ** Math.abs(character.floor - GROUND_FLOOR),
    };
  }

  /**
   * A workload's character is its own id, or `id#n` once a deploy has cast a newcomer. Prefer a visible
   * one, and of those the latest.
   */
  private find(id: string) {
    const matches = this.source
      .characters()
      .filter((character) => character.id === id || character.id.startsWith(`${id}#`));
    return matches.findLast((character) => character.visible) ?? matches.at(-1);
  }
}
