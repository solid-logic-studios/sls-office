import { Character } from './character.ts';

/** Stays at a post and stands there: the guards, the courier and the wrangler. */
export class Attendant extends Character {
  protected readonly speed = 40;

  protected behave(): void {
    if (this.moving) return;
    if (!this.atHome) {
      this.goHome();
      return;
    }
    this.sitAtHome();
    this.setActivity('stand');
  }
}
