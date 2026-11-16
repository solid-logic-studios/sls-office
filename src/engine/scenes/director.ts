import type { Character } from '../characters/character.ts';
import type { Playable } from './scene.ts';

/**
 * Owns the scene queue. Scenes are commands: one that needs a character already in another scene
 * waits its turn, in order; scenes with no actor in common play side by side.
 */
export class Director {
  private queue: Playable[] = [];
  private running: Playable[] = [];

  enqueue(scene: Playable): void {
    this.queue.push(scene);
    this.pump();
  }

  /** Starts an ambient errand now if its actors are free, or forgets it. */
  tryNow(scene: Playable): boolean {
    const actors = scene.audition();
    const reserved = this.reserved();
    if (actors === null || actors.some((actor) => actor.held || reserved.has(actor))) return false;
    this.begin(scene);
    return true;
  }

  update(): void {
    for (const scene of this.running) {
      if (scene.broken) scene.abort();
      else scene.advance();
    }
    this.running = this.running.filter((scene) => !scene.finished);
    this.pump();
  }

  get playing(): number {
    return this.running.length;
  }

  get waiting(): number {
    return this.queue.length;
  }

  private pump(): void {
    const reserved = new Set<Character>();
    for (const scene of [...this.queue]) {
      const actors = scene.audition();
      if (actors === null) {
        scene.drop();
        this.queue = this.queue.filter((queued) => queued !== scene);
        continue;
      }
      if (actors.some((actor) => actor.held || reserved.has(actor))) {
        for (const actor of actors) reserved.add(actor);
        continue;
      }
      this.queue = this.queue.filter((queued) => queued !== scene);
      this.begin(scene);
    }
  }

  private begin(scene: Playable): void {
    scene.start();
    if (!scene.finished) this.running.push(scene);
  }

  /** Characters that queued scenes are waiting for. */
  private reserved(): Set<Character> {
    return new Set(this.queue.flatMap((scene) => scene.audition() ?? []));
  }
}
