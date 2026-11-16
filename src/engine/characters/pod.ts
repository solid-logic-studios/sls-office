import { Character } from './character.ts';

/** Single use: works flat out at its bench until its job is done, then ticks, puffs and is gone. */
export class Pod extends Character {
  protected readonly speed = 62;

  protected behave(): void {
    if (this.moving) return;
    if (!this.atHome) {
      this.goHome();
      return;
    }
    this.work();
  }

  /** The pod run walks it in; once at its bench it works. */
  protected override whileHeld(): void {
    if (!this.moving && this.atHome) this.work();
  }

  /** Its entrance is the pod run, from the spawn point. */
  protected override announceArrival(): void {}

  protected override depart(): void {
    this.world.effects.mark('tick', this.x - 2, this.y - 28);
    this.vanish();
  }

  private work(): void {
    this.sitAtHome();
    this.setActivity('type', true);
  }
}
