import type { Spot } from '../../contract/theme.ts';
import type { Character } from '../characters/character.ts';
import type { World } from '../world.ts';

/** What a running script waits on: it resumes once this returns true. */
export type Condition = () => boolean;

/** A scene's steps, written as a generator that yields what it is waiting for. */
export type Script = Generator<Condition, void, void>;

/** What the director sees of a scene: a queued command it can start, advance or abort. */
export interface Playable {
  readonly finished: boolean;
  /** True once an actor the scene needs has gone missing. */
  readonly broken: boolean;
  /** The characters it must hold to start now, or `null` when it can never be played (it is dropped). */
  audition(): readonly Character[] | null;
  /** Holds the characters from the last audition and runs the opening up to its first wait. */
  start(): void;
  advance(): void;
  abort(): void;
  /** Dropped before it started. */
  drop(): void;
}

/**
 * A scripted sequence for a lab event. Every scene has the same shape (the Template Method): enter,
 * act, resolve, exit, each a hook a subclass fills in. `Crew` is who a scene plays with.
 */
export abstract class Scene<Crew> implements Playable {
  private done = false;
  private pending: Crew | null = null;
  private crew: Crew | null = null;
  private script: Script | null = null;
  private waitingOn: Condition | null = null;
  private readonly actors = new Set<Character>();

  constructor(protected readonly world: World) {}

  get finished(): boolean {
    return this.done;
  }

  /** An actor has gone absent, or left the lab. */
  get broken(): boolean {
    return [...this.actors].some((actor) => !actor.present || (actor.retiring && !actor.exiting));
  }

  audition(): readonly Character[] | null {
    this.pending = this.cast();
    return this.pending === null ? null : this.members(this.pending);
  }

  start(): void {
    const crew = this.pending;
    if (crew === null || this.done) return;
    this.crew = crew;
    for (const actor of this.members(crew)) this.hold(actor);
    this.script = this.play(crew);
    this.advance();
  }

  advance(): void {
    const script = this.script;
    if (script === null) return;
    while (this.waitingOn === null || this.waitingOn()) {
      const next = script.next();
      if (next.done === true) {
        this.finish();
        return;
      }
      this.waitingOn = next.value;
    }
  }

  abort(): void {
    if (this.done) return;
    if (this.crew !== null) this.onAbort(this.crew);
    this.finish();
  }

  drop(): void {
    this.done = true;
  }

  /** The fixed skeleton every scene follows. */
  private *play(crew: Crew): Script {
    yield* this.enter(crew);
    yield* this.act(crew);
    yield* this.resolve(crew);
    yield* this.exit(crew);
  }

  /* -------------------------------------------------------------- hooks */

  /** Who this scene needs right now, or `null` when it cannot be played. */
  protected abstract cast(): Crew | null;

  protected abstract members(crew: Crew): readonly Character[];

  /** Setting out: characters take their places. */
  protected abstract enter(crew: Crew): Script;

  /** The business of the scene, up to the moment it waits on the lab. */
  protected abstract act(crew: Crew): Script;

  /** The outcome. */
  protected abstract resolve(crew: Crew): Script;

  /** Clearing up: by default nothing. */
  protected *exit(crew: Crew): Script {
    void crew;
  }

  /** Called when an actor goes missing mid-scene, before the actors are released. */
  protected onAbort(crew: Crew): void {
    void crew;
  }

  /* ------------------------------------------------------------ helpers */

  /** Takes a character into the scene; it is released when the scene ends. */
  protected hold(actor: Character): void {
    if (this.actors.has(actor)) return;
    this.actors.add(actor);
    actor.hold();
  }

  protected release(actor: Character): void {
    if (this.actors.delete(actor)) actor.release();
  }

  protected *walk(actor: Character, spot: Spot, speed?: number): Script {
    actor.goTo(spot, speed);
    yield () => !actor.moving;
  }

  protected *walkHome(actor: Character, speed?: number): Script {
    actor.goHome(speed);
    yield () => !actor.moving;
  }

  protected *pause(seconds: number): Script {
    const until = this.world.now + seconds;
    yield () => this.world.now >= until;
  }

  private finish(): void {
    this.done = true;
    this.script = null;
    for (const actor of [...this.actors]) this.release(actor);
  }
}
