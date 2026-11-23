import type { DecorFn, Hotspot, Prop } from '../../contract/theme.ts';

/* Slice 5: the ground deck's dressing (ops floor, hangar, roof) (docs/design/hq-theme.md, section 11). JARVIS wires these into hqTheme. */

/** Painted in the back layer, after the structure, in this order. */
export const GROUND_DECK_BACK: readonly DecorFn[] = [];

/** Depth-sorted with the places and characters by base line. */
export const GROUND_DECK_PROPS: readonly Prop[] = [];

export const GROUND_DECK_HOTSPOTS: readonly Hotspot[] = [];
