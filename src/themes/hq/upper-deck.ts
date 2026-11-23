import type { DecorFn, Hotspot, Prop } from '../../contract/theme.ts';

/* Slice 4: the upper deck's dressing (rookie bay, archive vault, command deck, rec room) (docs/design/hq-theme.md, section 11). JARVIS wires these into hqTheme. */

/** Painted in the back layer, after the structure, in this order. */
export const UPPER_DECK_BACK: readonly DecorFn[] = [];

/** Depth-sorted with the places and characters by base line. */
export const UPPER_DECK_PROPS: readonly Prop[] = [];

export const UPPER_DECK_HOTSPOTS: readonly Hotspot[] = [];
