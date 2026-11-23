import type { DecorFn, Hotspot, Prop } from '../../contract/theme.ts';

/* Slice 6: the apron, the jet, its contrail and the off-site bunker (docs/design/hq-theme.md, section 11). JARVIS wires these into hqTheme. */

/** Painted in the back layer, after the structure, in this order. */
export const JET_BACK: readonly DecorFn[] = [];

/** Depth-sorted with the places and characters by base line. */
export const JET_PROPS: readonly Prop[] = [];

export const JET_HOTSPOTS: readonly Hotspot[] = [];
