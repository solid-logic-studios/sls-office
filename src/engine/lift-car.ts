import type { Floor } from '../contract/theme.ts';
import type { Character } from './characters/character.ts';

/** What the car needs to know about a character. */
export type LiftRider = Pick<Character, 'inLift' | 'liftLineY'>;

/**
 * Where the lift car is, as a walk line. It follows the first rider (cast order) while anyone rides;
 * once nobody does it parks on the floor nearest where the last ride left it. `null` until the first ride.
 */
export class LiftCar {
  private carY: number | null = null;
  private lastLine: number | null = null;
  private riding = false;

  constructor(private readonly floors: readonly Floor[]) {}

  get y(): number | null {
    return this.carY;
  }

  /** Whether a rider was found by the latest `update`. */
  get inUse(): boolean {
    return this.riding;
  }

  /** Call once per frame with the visible characters, after they have moved. */
  update(visible: readonly LiftRider[]): void {
    const line = visible.find((character) => character.inLift)?.liftLineY ?? null;
    this.riding = line !== null;
    if (line !== null) {
      this.lastLine = line;
      this.carY = line;
    } else if (this.lastLine !== null) {
      this.carY = this.nearestWalkY(this.lastLine);
    }
  }

  private nearestWalkY(line: number): number {
    const nearest = this.floors.reduce<number | null>(
      (best, floor) => (best === null || Math.abs(floor.walkY - line) < Math.abs(best - line) ? floor.walkY : best),
      null,
    );
    return nearest ?? line;
  }
}
