import type { Layout, Part, Place } from '../contract/theme.ts';
import type { Character } from './characters/character.ts';

/** Which character lives at which place. A character keeps its home for life, or hands it to its successor. */
export class Homes {
  private readonly occupants = new Map<Place, Character>();

  constructor(private readonly places: Layout['homes']) {}

  /** The first free place for a part, in the Theme's order. */
  free(part: Part): Place | null {
    return this.places[part].find((place) => !this.occupants.has(place)) ?? null;
  }

  occupy(place: Place, character: Character): void {
    this.occupants.set(place, character);
  }

  vacate(place: Place, character: Character): void {
    if (this.occupants.get(place) === character) this.occupants.delete(place);
  }

  occupantOf(place: Place): Character | null {
    return this.occupants.get(place) ?? null;
  }

  /** A part's places that have somebody, in order. */
  occupied(part: Part): readonly Place[] {
    return this.places[part].filter((place) => this.occupants.has(place));
  }

  /** Every place of every part. */
  all(): readonly Place[] {
    return Object.values(this.places).flat();
  }
}
