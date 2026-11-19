import type { Floor } from '../contract/theme.ts';
import type { Character } from './characters/character.ts';

/**
 * Where the lift car is, as a walk line. It follows the first rider (cast order) while anyone rides,
 * and stays at the floor the last ride ended on. `null` until the first ride.
 */
export class LiftCar {
  private carY: number | null = null;
  private rider: Character | null = null;

  constructor(private readonly floors: readonly Floor[]) {}

  get y(): number | null {
    return this.carY;
  }

  /** Call once per frame with the visible characters, after they have moved. */
  update(visible: readonly Character[]): void {
    const riding = visible.find((character) => character.inLift);
    const line = riding?.liftLineY ?? null;
    if (riding !== undefined && line !== null) {
      this.rider = riding;
      this.carY = line;
      return;
    }
    // The ride just ended: park the car on the walk line of the floor the rider was put down on.
    const parked = this.rider === null ? undefined : this.floors[this.rider.floor];
    if (parked !== undefined) this.carY = parked.walkY;
    this.rider = null;
  }
}
