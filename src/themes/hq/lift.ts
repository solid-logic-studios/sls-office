import type { DecorFn, Hotspot, Prop } from '../../contract/theme.ts';

/* Slice 7: the lift car, doors, landing lamps and cables (docs/design/hq-theme.md, section 11). JARVIS wires these into hqTheme. */

/** Painted in the back layer, after the structure, in this order. */
export const LIFT_BACK: readonly DecorFn[] = [];

/** Depth-sorted with the places and characters by base line. */
export const LIFT_PROPS: readonly Prop[] = [];

export const LIFT_HOTSPOTS: readonly Hotspot[] = [];
