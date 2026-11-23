import type { Rect } from '../../contract/theme.ts';
import type { CoreSpec } from './core.ts';
import { SUBLEVEL } from './geometry.ts';
import type { ConsoleSpec } from './jarvis-console.ts';

/**
 * Set pieces that both the art and a Hotspot need, so a moved piece moves its hover target too.
 * The pixel font is 6 art px a character (7 bold), so every board is sized from its text.
 */

/**
 * The JARVIS console in the middle of the command deck: the readout under the ceiling, the orb
 * floating below it and the projector it floats over.
 */
export const JARVIS: ConsoleSpec = {
  readout: { x: 276, y: 47, w: 164, h: 12 },
  orb: { cx: 358, cy: 86, r: 15 },
  pedestal: { x: 343, y: 108, w: 30, h: 12 },
};

/** The orb's hover target: everything from the top of its halo down to the foot of the projector. */
export const JARVIS_CONSOLE: Rect = { x: 334, y: 62, w: 48, h: 58 };

/** The conduit that runs up the back wall of the ops floor, from the core to the orb. */
export const SPINE = { x: 356, w: 4 } as const;

/** The power core: the hub sits straight under the orb, the cell banks to its left, the drives to its right. */
export const CORE: CoreSpec = {
  chamber: SUBLEVEL,
  hub: { cx: 358, cy: 274, r: 17 },
  banks: { x: 170, cpuY: 259, memY: 283, cells: 12 },
  drives: { ssdX: 392, nvmeX: 416, y: 256 },
  tag: { x: 436, y: 262, w: 56, h: 18 },
  plate: { x: 14, title: 262, model: 273, temps: 290 },
  relays: { x: 502, y: 258, columns: 10, name: 290 },
};

/** The whole sub-level is the host's hover target. */
export const POWER_CORE: Rect = SUBLEVEL;
