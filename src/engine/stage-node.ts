import type { Painter } from '../contract/painter.ts';
import type { Occupant, Place, Prop, StageView, Tip } from '../contract/theme.ts';
import type { Homes } from './homes.ts';

/**
 * Anything on the stage that is depth-sorted: places, props and characters. The Stage keeps them in
 * one flat list, because depth sorting crosses rooms; there is no office, floor or room tree.
 */
export interface StageNode {
  /** Nodes are drawn from the smallest base line to the largest. */
  readonly baseY: number;
  draw(painter: Painter, stage: StageView): void;
  /** This node's tooltip when the point is over it, else `null`. */
  tipAt(x: number, y: number): Tip | null;
}

/** A piece of furniture one character calls home. Its tooltip is its occupant's, even when away. */
export class PlaceNode implements StageNode {
  constructor(
    private readonly place: Place,
    private readonly homes: Homes,
  ) {}

  get baseY(): number {
    return this.place.baseY;
  }

  draw(painter: Painter, stage: StageView): void {
    this.place.art(painter, { place: this.place, occupant: this.occupant(), stage });
  }

  tipAt(x: number, y: number): Tip | null {
    const { place } = this;
    if (x < place.x || x > place.x + place.w || y < place.baseY - place.h || y > place.baseY) return null;
    return this.homes.occupantOf(place)?.tip() ?? null;
  }

  private occupant(): Occupant | null {
    const character = this.homes.occupantOf(this.place);
    if (character === null || character.subject === null) return null;
    const atSeat = character.visible && character.atHome && character.mood !== 'fainted';
    return { subject: character.subject, mood: character.mood, atSeat };
  }
}

/** Set dressing from the Theme. It has no tooltip; hotspots do that. */
export class PropNode implements StageNode {
  constructor(private readonly prop: Prop) {}

  get baseY(): number {
    return this.prop.baseY;
  }

  draw(painter: Painter, stage: StageView): void {
    this.prop.draw(painter, stage);
  }

  tipAt(): Tip | null {
    return null;
  }
}
